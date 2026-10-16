
const API_BASE_URL = (
  import.meta.env.VITE_DEMAND_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const ENDPOINT = "/explainability/research/summary";

export async function getResearchExplainability(signal) {
  const response = await fetch(
    `${API_BASE_URL}${ENDPOINT}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    let message =
      `Research explainability request failed ` +
      `(HTTP ${response.status}).`;

    try {
      const body = await response.json();

      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // Retain the HTTP error message.
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (
    data.status !== "success" ||
    data.model !== "no_price_tft" ||
    data.interpretation_partition !== "2024_validation" ||
    data.forecast_horizon_weeks !== 4 ||
    data.encoder_history_weeks !== 52 ||
    data.auction_price_inputs_in_model !== false
  ) {
    throw new Error(
      "The API returned unexpected research " +
      "explainability metadata."
    );
  }

  const featureGroups = [
    "static_feature_importance",
    "encoder_feature_importance",
    "decoder_feature_importance",
  ];

  for (const group of featureGroups) {
    if (
      !Array.isArray(data[group]) ||
      data[group].length === 0 ||
      !data[group].every(
        (item) =>
          typeof item.feature === "string" &&
          Number.isFinite(
            item.relative_importance_percent
          )
      )
    ) {
      throw new Error(
        `Invalid research explanation group: ${group}.`
      );
    }
  }

  if (
    !Array.isArray(
      data.top_historical_attention_positions
    ) ||
    !data.top_historical_attention_positions.every(
      (item) =>
        Number.isInteger(
          item.weeks_before_latest_observation
        ) &&
        Number.isFinite(
          item.relative_attention_percent
        )
    ) ||
    !Array.isArray(data.limitations)
  ) {
    throw new Error(
      "Invalid historical attention or limitations data."
    );
  }

  return data;
}
