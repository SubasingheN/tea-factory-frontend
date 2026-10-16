
const API_BASE_URL = (
  import.meta.env.VITE_DEMAND_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const RESEARCH_ENDPOINT = "/forecast/research/latest";

export const TEA_GRADES = [
  "BOP",
  "BOPF",
  "Dust",
  "OP",
  "Pekoe",
];

export async function getResearchTFTForecast(
  signal
) {
  const response = await fetch(
    `${API_BASE_URL}${RESEARCH_ENDPOINT}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    let message = (
      `Unable to retrieve research forecasts ` +
      `(HTTP ${response.status}).`
    );

    try {
      const error = await response.json();

      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (typeof error.message === "string") {
        message = error.message;
      }
    } catch {
      // Preserve the HTTP error message.
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (
    data.status !== "success" ||
    data.model !== "no_price_tft" ||
    data.forecast_type !== "dataset_origin_forecast" ||
    data.forecast_horizon_weeks !== 4 ||
    data.forecast_count !== 20 ||
    !data.forecasts ||
    typeof data.forecasts !== "object"
  ) {
    throw new Error(
      "The research API returned an unexpected " +
      "forecast format."
    );
  }

  const receivedGrades = Object.keys(
    data.forecasts
  );

  if (
    receivedGrades.length !== TEA_GRADES.length ||
    !TEA_GRADES.every((grade) =>
      receivedGrades.includes(grade)
    )
  ) {
    throw new Error(
      "The research forecast is missing a tea grade."
    );
  }

  for (const grade of TEA_GRADES) {
    const weeks = data.forecasts[grade];

    if (!Array.isArray(weeks) || weeks.length !== 4) {
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
          `Invalid forecast values for ${grade}, ` +
          `week ${index + 1}.`
        );
      }
    });
  }

  return data;
}
