
const API_BASE_URL = (
  import.meta.env.VITE_DEMAND_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export const SELECTABLE_TEA_GRADES = [
  "BOP",
  "BOPF",
  "Dust",
  "OP",
  "Pekoe",
];

export const FORECAST_HORIZON_WEEKS = 4;

function extractErrorMessage(errorData, fallback) {
  if (typeof errorData?.detail === "string") {
    return errorData.detail;
  }

  if (Array.isArray(errorData?.detail)) {
    return errorData.detail
      .map((item) => item.msg || "Invalid input")
      .join("; ");
  }

  if (typeof errorData?.message === "string") {
    return errorData.message;
  }

  return fallback;
}

async function researchRequest(
  endpoint,
  options = {}
) {
  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options.headers,
        },
        cache: "no-store",
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the forecasting backend. " +
      "Check that FastAPI is running on port 8000."
    );
  }

  if (!response.ok) {
    let errorData = null;

    try {
      errorData = await response.json();
    } catch {
      // Keep the default HTTP error.
    }

    throw new Error(
      extractErrorMessage(
        errorData,
        `Forecast request failed (HTTP ${response.status}).`
      )
    );
  }

  return response.json();
}

export function validateSelectedWeeklyInput(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Weekly input is required.");
  }

  if (
    typeof payload.week_start_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.week_start_date)
  ) {
    throw new Error("A valid completed-week date is required.");
  }

  const weekDate = new Date(
    `${payload.week_start_date}T12:00:00Z`
  );

  if (
    Number.isNaN(weekDate.getTime()) ||
    weekDate.toISOString().slice(0, 10) !==
      payload.week_start_date ||
    weekDate.getUTCDay() !== 1
  ) {
    throw new Error(
      "The completed week must start on a Monday."
    );
  }

  if (
    !Array.isArray(payload.records) ||
    payload.records.length < 1 ||
    payload.records.length > 5
  ) {
    throw new Error(
      "Select between one and five tea grades."
    );
  }

  const selectedGrades = new Set();

  for (const record of payload.records) {
    if (!SELECTABLE_TEA_GRADES.includes(record.tea_type)) {
      throw new Error("Invalid tea grade selected.");
    }

    if (selectedGrades.has(record.tea_type)) {
      throw new Error(
        `Duplicate tea grade: ${record.tea_type}`
      );
    }

    selectedGrades.add(record.tea_type);

    for (const field of [
      "demand_kg",
      "production_kg",
      "inventory_kg",
    ]) {
      const value = record[field];

      if (
        value === "" ||
        value === null ||
        value === undefined ||
        typeof value === "boolean" ||
        !Number.isFinite(Number(value))
      ) {
        throw new Error(
          `Enter a valid ${field} for ${record.tea_type}.`
        );
      }

      const quantity = Number(value);

      if (
        quantity < 0 ||
        quantity > 100000 ||
        (field === "demand_kg" && quantity === 0)
      ) {
        throw new Error(
          `Check ${field} for ${record.tea_type}.`
        );
      }
    }
  }

  return {
    week_start_date: payload.week_start_date,
    records: payload.records.map((record) => ({
      tea_type: record.tea_type,
      demand_kg: Number(record.demand_kg),
      production_kg: Number(record.production_kg),
      inventory_kg: Number(record.inventory_kg),
    })),
  };
}

export function validateSelectedForecastResponse(data) {
  if (
    data?.status !== "success" ||
    data.model !== "no_price_tft" ||
    data.forecast_type !== "selected_operational_forecast" ||
    !Array.isArray(data.selected_grades) ||
    !data.forecasts ||
    typeof data.forecasts !== "object"
  ) {
    throw new Error(
      "The selected TFT API returned an unexpected response."
    );
  }

  const grades = data.selected_grades;

  if (
    grades.length < 1 ||
    grades.length > 5 ||
    new Set(grades).size !== grades.length ||
    grades.some(
      (grade) => !SELECTABLE_TEA_GRADES.includes(grade)
    ) ||
    Object.keys(data.forecasts).length !== grades.length ||
    data.forecast_count !==
      grades.length * FORECAST_HORIZON_WEEKS
  ) {
    throw new Error("Invalid forecast grade selection.");
  }

  for (const grade of grades) {
    const weeks = data.forecasts[grade];

    if (
      !Array.isArray(weeks) ||
      weeks.length !== FORECAST_HORIZON_WEEKS
    ) {
      throw new Error(
        `Expected four forecast weeks for ${grade}.`
      );
    }

    weeks.forEach((week, index) => {
      const lower = Number(week.lower_demand_kg);
      const median = Number(week.median_demand_kg);
      const upper = Number(week.upper_demand_kg);

      if (
        week.horizon !== index + 1 ||
        !Number.isFinite(lower) ||
        !Number.isFinite(median) ||
        !Number.isFinite(upper) ||
        lower < 0 ||
        lower > median ||
        median > upper
      ) {
        throw new Error(
          `Invalid forecast values for ${grade}, week ${index + 1}.`
        );
      }
    });
  }

  return data;
}

export async function generateSelectiveTFTForecast(
  weeklyInput
) {
  const payload = validateSelectedWeeklyInput(
    weeklyInput
  );

  const data = await researchRequest(
    "/forecast/research/selected",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return validateSelectedForecastResponse(data);
}

export async function saveSelectiveTestForecast(
  weeklyInput
) {
  const payload = validateSelectedWeeklyInput(
    weeklyInput
  );

  return researchRequest(
    "/forecast/research/selected/save",
    {
      method: "POST",
      body: JSON.stringify({
        weekly_input: payload,
      }),
    }
  );
}

export async function compareSelectiveForecastRuns(
  previousRunId,
  newRunId
) {
  if (
    !previousRunId ||
    !newRunId ||
    previousRunId === newRunId
  ) {
    throw new Error(
      "Select two different saved forecast runs."
    );
  }

  const query = new URLSearchParams({
    previous_run_id: previousRunId,
    new_run_id: newRunId,
  });

  return researchRequest(
    `/forecast/research/compare?${query.toString()}`
  );
}

export function formatForecastDate(isoDate) {
  if (
    typeof isoDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)
  ) {
    return "Date unavailable";
  }

  const date = new Date(`${isoDate}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
