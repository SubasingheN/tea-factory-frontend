
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  Download,
  FileText,
  Files,
  RefreshCw,
  CalendarDays,
  TrendingUp,
  Package,
  ClipboardCheck,
} from "lucide-react";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  EIGHT_INPUT_GRADES,
  EIGHT_INPUT_FIELDS,
  getEightInputHistoricalWeek,
} from "../../services/eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const CHANGE_THRESHOLD_PERCENT = 15;

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  ivory: "#F5F3E9",
  white: "#FFFFFF",
  muted: "#63756A",
  border: "#D8E2D3",
  danger: "#A73939",
  warning: "#805C19",
};

const PANEL_STYLE = {
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 22,
  marginBottom: 18,
};

const CELL_STYLE = {
  padding: "12px 13px",
  borderBottom: `1px solid ${COLORS.border}`,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const FIELD_LABELS = {
  demand_kg: "Recorded Demand",
  production_kg: "Recorded Production",
  inventory_kg: "Recorded Inventory",
  usd_lkr_monday_rate: "USD/LKR Monday Rate",
  usd_lkr_sunday_rate: "USD/LKR Sunday Rate",
  festival_flag: "Festival Week",
  auction_price_high_lkr:
    "High-Elevation Auction Price",
  auction_price_medium_lkr:
    "Medium-Elevation Auction Price",
  auction_price_low_lkr:
    "Low-Elevation Auction Price",
};

const ALL_INPUT_FIELDS = Array.from(
  new Set([
    ...EIGHT_INPUT_FIELDS,
    ...Object.keys(FIELD_LABELS),
  ])
);

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function formatNumber(value, digits = 2) {
  const number = numberOrNull(value);

  return number === null
    ? "—"
    : number.toLocaleString("en-GB", {
        maximumFractionDigits: digits,
      });
}

function formatKg(value) {
  return numberOrNull(value) === null
    ? "—"
    : `${formatNumber(value)} kg`;
}

function formatPercent(value) {
  const number = numberOrNull(value);

  if (number === null) {
    return "—";
  }

  return `${
    number > 0 ? "+" : ""
  }${formatNumber(number, 1)}%`;
}

function addDays(value, days) {
  if (!value) return "";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatWeek(value) {
  return (
    `${formatDate(value)} - ` +
    formatDate(addDays(value, 6))
  );
}

function getLatestCompletedWeek() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const part = (type) =>
    Number(
      parts.find(
        (item) => item.type === type
      )?.value
    );

  const date = new Date(
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day")
    )
  );

  const daysSinceMonday =
    (date.getUTCDay() + 6) % 7;

  date.setUTCDate(
    date.getUTCDate() -
      daysSinceMonday -
      7
  );

  return date.toISOString().slice(0, 10);
}

function formatInput(field, value) {
  if (field === "festival_flag") {
    const number = numberOrNull(value);

    if (number === 1) return "Yes";
    if (number === 0) return "No";

    return "—";
  }

  if (
    field === "demand_kg" ||
    field === "production_kg" ||
    field === "inventory_kg"
  ) {
    return formatKg(value);
  }

  if (field.startsWith("usd_lkr_")) {
    return formatNumber(value, 4);
  }

  if (
    field.startsWith("auction_price_")
  ) {
    const number = numberOrNull(value);

    return number === null
      ? "—"
      : `LKR ${formatNumber(number)}`;
  }

  return formatNumber(value);
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "Unable to load demand reports."
  );
}

function validateForecast(
  record,
  origin,
  grade
) {
  if (
    !record ||
    record.finalized !== true ||
    record.forecast_origin !== origin ||
    record.tea_type !== grade ||
    !Array.isArray(record.forecasts) ||
    record.forecasts.length !== 4
  ) {
    return false;
  }

  return record.forecasts.every(
    (prediction, index) => {
      if (
        prediction?.week !==
          addDays(origin, (index + 1) * 7) ||
        Number(prediction.horizon) !==
          index + 1
      ) {
        return false;
      }

      const values = [
        prediction.lower_demand_kg,
        prediction.median_demand_kg,
        prediction.upper_demand_kg,
      ].map(numberOrNull);

      return (
        values.every(
          (value) => value !== null
        ) &&
        values[0] >= 0 &&
        values[0] <= values[1] &&
        values[1] <= values[2]
      );
    }
  );
}

async function fetchLatestRevision(origin) {
  const params = new URLSearchParams({
    origin,
  });

  let response;

  try {
    response = await fetch(
      `${API_BASE}/research/eight-input/history/revisions?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the factory backend."
    );
  }

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Unable to load saved forecast versions."
    );
  }

  if (
    result.status !== "success" ||
    result.forecast_origin !== origin ||
    !Array.isArray(result.revisions)
  ) {
    throw new Error(
      "The saved forecast response is invalid."
    );
  }

  const revisions = result.revisions
    .filter(
      (item) =>
        Number.isInteger(item.revision) &&
        item.revision >= 0 &&
        item.forecasts &&
        typeof item.forecasts === "object"
    )
    .sort(
      (left, right) =>
        right.revision - left.revision
    );

  if (
    result.available === false ||
    revisions.length === 0
  ) {
    throw new Error(
      "No saved forecast is available for the latest completed week."
    );
  }

  const latest = revisions[0];

  for (const grade of EIGHT_INPUT_GRADES) {
    if (
      !validateForecast(
        latest.forecasts[grade],
        origin,
        grade
      )
    ) {
      throw new Error(
        `The latest saved ${grade} forecast is incomplete.`
      );
    }
  }

  return latest;
}

function extractRecords(response) {
  if (Array.isArray(response?.records)) {
    return response.records;
  }

  if (Array.isArray(response?.observations)) {
    return response.observations;
  }

  if (Array.isArray(response?.data?.records)) {
    return response.data.records;
  }

  return [];
}

function demandChange(predicted, baseline) {
  const prediction = numberOrNull(predicted);
  const recorded = numberOrNull(baseline);

  if (
    prediction === null ||
    recorded === null ||
    recorded <= 0
  ) {
    return null;
  }

  return (
    ((prediction - recorded) / recorded) *
    100
  );
}

function demandStatus(change) {
  if (change === null) {
    return "Data Unavailable";
  }

  if (change >= CHANGE_THRESHOLD_PERCENT) {
    return "Demand Increase";
  }

  if (change <= -CHANGE_THRESHOLD_PERCENT) {
    return "Demand Decrease";
  }

  return "No Major Change";
}

function recommendation(status) {
  if (status === "Demand Increase") {
    return (
      "Review production capacity, available stock, " +
      "incoming supplies, and confirmed orders. " +
      "Prepare for higher demand if needed."
    );
  }

  if (status === "Demand Decrease") {
    return (
      "Review production and purchasing plans. " +
      "Avoid excess inventory after checking confirmed orders."
    );
  }

  if (status === "No Major Change") {
    return (
      "Maintain regular production and stock planning. " +
      "Monitor actual orders and inventory levels."
    );
  }

  return (
    "Check the recorded demand information before " +
    "making demand-based planning decisions."
  );
}

function buildGradeReport(
  grade,
  forecastRecord,
  observation,
  origin,
  revision
) {
  const baseline =
    numberOrNull(observation?.demand_kg);

  const inventory =
    numberOrNull(observation?.inventory_kg);

  const production =
    numberOrNull(observation?.production_kg);

  const weeks = forecastRecord.forecasts.map(
    (prediction) => {
      const lower = Number(
        prediction.lower_demand_kg
      );

      const expected = Number(
        prediction.median_demand_kg
      );

      const upper = Number(
        prediction.upper_demand_kg
      );

      const change = demandChange(
        expected,
        baseline
      );

      const status = demandStatus(change);

      return {
        horizon: Number(
          prediction.horizon
        ),
        week: prediction.week,
        lower,
        expected,
        upper,
        change,
        status,
        action: recommendation(status),
      };
    }
  );

  const nextWeek = weeks[0];

  let stockStatus =
    "Recorded inventory unavailable";

  let stockAction =
    "Check current inventory before finalizing stock plans.";

  if (inventory !== null) {
    if (inventory < nextWeek.expected) {
      stockStatus =
        "Stock-coverage review required";

      stockAction =
        "Recorded inventory is below next week's expected demand. " +
        "Check planned production, incoming supplies, " +
        "committed orders, and dispatches.";
    } else {
      stockStatus =
        "No immediate stock flag";

      stockAction =
        "Continue checking stock coverage against " +
        "confirmed orders and planned deliveries.";
    }
  }

  const statuses = weeks.map(
    (week) => week.status
  );

  let overallStatus =
    "No Major Change";

  if (
    statuses.every(
      (status) =>
        status === "Data Unavailable"
    )
  ) {
    overallStatus = "Data Unavailable";
  } else if (
    statuses.includes("Demand Increase") &&
    statuses.includes("Demand Decrease")
  ) {
    overallStatus = "Mixed Demand Changes";
  } else if (
    statuses.includes("Demand Increase")
  ) {
    overallStatus = "Demand Increase";
  } else if (
    statuses.includes("Demand Decrease")
  ) {
    overallStatus = "Demand Decrease";
  }

  return {
    grade,
    origin,
    revision,
    observation: observation || null,
    baseline,
    inventory,
    production,
    overallStatus,
    stockStatus,
    stockAction,
    weeks,
    totalExpected: weeks.reduce(
      (sum, week) =>
        sum + week.expected,
      0
    ),
  };
}

function Panel({
  title,
  icon: Icon,
  children,
}) {
  return (
    <section style={PANEL_STYLE}>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 18px",
          color: COLORS.forest,
          fontSize: 19,
        }}
      >
        {Icon && <Icon size={21} />}
        {title}
      </h2>

      {children}
    </section>
  );
}

function ReportTable({
  headers,
  rows,
}) {
  return (
    <div
      style={{
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: 720,
          borderCollapse: "collapse",
          textAlign: "left",
        }}
      >
        <thead>
          <tr
            style={{
              background: COLORS.forest,
              color: COLORS.white,
            }}
          >
            {headers.map((header) => (
              <th
                key={header}
                style={{
                  padding: 12,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map(
                (cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    style={CELL_STYLE}
                  >
                    {cell === null ||
                    cell === undefined
                      ? "—"
                      : cell}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastRows({ report }) {
  return (
    <ReportTable
      headers={[
        "Forecast Week",
        "Lower Demand",
        "Expected Demand",
        "Upper Demand",
        "Change",
        "Status",
      ]}
      rows={report.weeks.map(
        (week) => [
          `Week ${week.horizon}: ${formatWeek(week.week)}`,
          formatKg(week.lower),
          formatKg(week.expected),
          formatKg(week.upper),
          formatPercent(week.change),
          week.status,
        ]
      )}
    />
  );
}

function GradeReport({
  report,
  onDownload,
  downloading,
}) {
  return (
    <Panel
      title={`${report.grade} Report`}
      icon={FileText}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <span
          style={{
            color: COLORS.muted,
            fontSize: 13,
          }}
        >
          Reporting Week:{" "}
          {formatWeek(report.origin)}
        </span>

        <button
          type="button"
          className="report-download-btn"
          onClick={onDownload}
          disabled={downloading}
        >
          <Download size={17} />
          Download {report.grade} PDF
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 23,
        }}
      >
        {[
          [
            "Recorded Demand",
            formatKg(report.baseline),
          ],
          [
            "Recorded Production",
            formatKg(report.production),
          ],
          [
            "Recorded Inventory",
            formatKg(report.inventory),
          ],
          [
            "Four-Week Expected Demand",
            formatKg(report.totalExpected),
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: 16,
              background: COLORS.ivory,
              borderRadius: 11,
              border:
                `1px solid ${COLORS.border}`,
            }}
          >
            <div
              style={{
                color: COLORS.muted,
                fontSize: 12,
                marginBottom: 7,
              }}
            >
              {label}
            </div>

            <strong
              style={{
                color: COLORS.forest,
              }}
            >
              {value}
            </strong>
          </div>
        ))}
      </div>

      <h3
        style={{
          color: COLORS.forest,
          fontSize: 16,
        }}
      >
        Recorded Factory Data
      </h3>

      <ReportTable
        headers={[
          "Input",
          "Recorded Value",
        ]}
        rows={ALL_INPUT_FIELDS.map(
          (field) => [
            FIELD_LABELS[field] || field,
            formatInput(
              field,
              report.observation?.[field]
            ),
          ]
        )}
      />

      <h3
        style={{
          color: COLORS.forest,
          fontSize: 16,
          marginTop: 25,
        }}
      >
        Four-Week Demand Forecast
      </h3>

      <ForecastRows report={report} />

      <h3
        style={{
          color: COLORS.forest,
          fontSize: 16,
          marginTop: 25,
        }}
      >
        Alerts & Recommendations
      </h3>

      <p
        style={{
          color: COLORS.muted,
        }}
      >
        <strong>Demand status: </strong>
        {report.overallStatus}
      </p>

      <p
        style={{
          color: COLORS.muted,
        }}
      >
        <strong>Inventory status: </strong>
        {report.stockStatus}
      </p>

      <p
        style={{
          color: COLORS.muted,
          lineHeight: 1.7,
        }}
      >
        {report.stockAction}
      </p>

      {report.weeks.map((week) => (
        <div
          key={week.week}
          style={{
            padding: "13px 0",
            borderTop:
              `1px solid ${COLORS.border}`,
          }}
        >
          <strong
            style={{
              color: COLORS.forest,
            }}
          >
            Week {week.horizon}
            {" — "}
            {formatWeek(week.week)}
          </strong>

          <p
            style={{
              margin: "7px 0 4px",
              color: COLORS.muted,
            }}
          >
            {week.status}
            {" · "}
            {formatPercent(week.change)}
          </p>

          <p
            style={{
              margin: 0,
              lineHeight: 1.6,
              color: COLORS.muted,
            }}
          >
            {week.action}
          </p>
        </div>
      ))}
    </Panel>
  );
}

function pdfText(value) {
  return String(value ?? "—")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("•", "-");
}

function addPdfHeading(
  doc,
  text,
  y
) {
  const height =
    doc.internal.pageSize.getHeight();

  if (y > height - 30) {
    doc.addPage();
    y = 18;
  }

  doc.setFont(
    "helvetica",
    "bold"
  );
  doc.setFontSize(13);
  doc.setTextColor(
    21,
    61,
    43
  );

  doc.text(
    pdfText(text),
    15,
    y
  );

  return y + 9;
}

function addPdfParagraph(
  doc,
  text,
  y
) {
  const width =
    doc.internal.pageSize.getWidth();

  const height =
    doc.internal.pageSize.getHeight();

  doc.setFont(
    "helvetica",
    "normal"
  );
  doc.setFontSize(10);
  doc.setTextColor(
    65,
    75,
    70
  );

  const lines = doc.splitTextToSize(
    pdfText(text),
    width - 30
  );

  const lineHeight = 5;
  const blockHeight =
    lines.length * lineHeight;

  if (
    y + blockHeight >
    height - 17
  ) {
    doc.addPage();
    y = 18;
  }

  doc.text(
    lines,
    15,
    y
  );

  return y +
    blockHeight +
    5;
}

function addPdfTable(
  doc,
  headers,
  rows,
  y
) {
  const height =
    doc.internal.pageSize.getHeight();

  if (y > height - 28) {
    doc.addPage();
    y = 17;
  }

  autoTable(doc, {
    startY: y,
    head: [
      headers.map(pdfText),
    ],
    body: rows.map(
      (row) =>
        row.map(pdfText)
    ),
    theme: "grid",
    margin: {
      left: 15,
      right: 15,
      top: 16,
      bottom: 17,
    },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [
        21,
        61,
        43,
      ],
      textColor: 255,
    },
    alternateRowStyles: {
      fillColor: [
        246,
        248,
        244,
      ],
    },
  });

  return (
    (doc.lastAutoTable?.finalY ||
      y) + 11
  );
}

function addPdfGradeReport(
  doc,
  report,
  startNewPage = false
) {
  if (startNewPage) {
    doc.addPage();
  }

  let y = 18;

  y = addPdfHeading(
    doc,
    `${report.grade} Demand Report`,
    y
  );

  y = addPdfParagraph(
    doc,
    `Reporting Week: ${formatWeek(report.origin)}. ` +
    `Forecast Version: ${
      report.revision === 0
        ? "Original Forecast"
        : `Revision ${report.revision}`
    }.`,
    y
  );

  y = addPdfHeading(
    doc,
    "Demand Summary",
    y
  );

  y = addPdfTable(
    doc,
    [
      "Information",
      "Value",
    ],
    [
      [
        "Recorded Demand",
        formatKg(report.baseline),
      ],
      [
        "Recorded Production",
        formatKg(report.production),
      ],
      [
        "Recorded Inventory",
        formatKg(report.inventory),
      ],
      [
        "Four-Week Expected Demand",
        formatKg(report.totalExpected),
      ],
      [
        "Demand Status",
        report.overallStatus,
      ],
      [
        "Inventory Status",
        report.stockStatus,
      ],
    ],
    y
  );

  y = addPdfHeading(
    doc,
    "Recorded Factory Data",
    y
  );

  y = addPdfTable(
    doc,
    [
      "Input Parameter",
      "Recorded Value",
    ],
    ALL_INPUT_FIELDS.map(
      (field) => [
        FIELD_LABELS[field] || field,
        formatInput(
          field,
          report.observation?.[field]
        ),
      ]
    ),
    y
  );

  y = addPdfHeading(
    doc,
    "Four-Week Demand Forecast",
    y
  );

  y = addPdfTable(
    doc,
    [
      "Week",
      "Dates",
      "Lower (kg)",
      "Expected (kg)",
      "Upper (kg)",
      "Change",
      "Status",
    ],
    report.weeks.map(
      (week) => [
        week.horizon,
        formatWeek(week.week),
        formatNumber(week.lower),
        formatNumber(week.expected),
        formatNumber(week.upper),
        formatPercent(week.change),
        week.status,
      ]
    ),
    y
  );

  y = addPdfHeading(
    doc,
    "Inventory Recommendation",
    y
  );

  y = addPdfParagraph(
    doc,
    report.stockAction,
    y
  );

  y = addPdfHeading(
    doc,
    "Weekly Recommendations",
    y
  );

  for (
    const week of report.weeks
  ) {
    y = addPdfHeading(
      doc,
      `Week ${week.horizon}: ${formatWeek(week.week)}`,
      y
    );

    y = addPdfParagraph(
      doc,
      `${week.status} (${formatPercent(week.change)}). ` +
      week.action,
      y
    );
  }

  addPdfParagraph(
    doc,
    "Planning note: Forecast demand is an estimate, " +
    "not a confirmed customer order. Stock reviews " +
    "must consider scheduled production, incoming " +
    "supplies, and dispatches.",
    y
  );
}

function addPdfPageNumbers(doc) {
  const totalPages =
    doc.internal.getNumberOfPages();

  for (
    let page = 1;
    page <= totalPages;
    page += 1
  ) {
    doc.setPage(page);

    const width =
      doc.internal.pageSize.getWidth();

    const height =
      doc.internal.pageSize.getHeight();

    doc.setFontSize(9);
    doc.setTextColor(
      115,
      125,
      118
    );

    doc.text(
      `Page ${page} of ${totalPages}`,
      width - 15,
      height - 8,
      {
        align: "right",
      }
    );
  }
}

function createPdf() {
  return new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
}

function downloadGradePdf(report) {
  const doc = createPdf();

  addPdfGradeReport(
    doc,
    report
  );

  addPdfPageNumbers(doc);

  doc.save(
    `tea_demand_${report.grade}_${report.origin}_revision_${report.revision}.pdf`
  );
}

function downloadCompletePdf(
  reports,
  origin,
  revision
) {
  const doc = createPdf();

  let y = 18;

  y = addPdfHeading(
    doc,
    "Tea Factory Management System",
    y
  );

  y = addPdfHeading(
    doc,
    "Complete Tea Demand Report",
    y
  );

  y = addPdfParagraph(
    doc,
    `Reporting Week: ${formatWeek(origin)}. ` +
    `Forecast Version: ${
      revision === 0
        ? "Original Forecast"
        : `Revision ${revision}`
    }. All five tea grades are included.`,
    y
  );

  y = addPdfHeading(
    doc,
    "Overall Demand Summary",
    y
  );

  y = addPdfTable(
    doc,
    [
      "Tea Grade",
      "Recorded Demand",
      "Production",
      "Inventory",
      "Four-Week Expected Demand",
      "Demand Status",
      "Inventory Check",
    ],
    reports.map(
      (report) => [
        report.grade,
        formatKg(report.baseline),
        formatKg(report.production),
        formatKg(report.inventory),
        formatKg(report.totalExpected),
        report.overallStatus,
        report.stockStatus,
      ]
    ),
    y
  );

  y = addPdfHeading(
    doc,
    "Expected Demand by Forecast Week",
    y
  );

  y = addPdfTable(
    doc,
    [
      "Forecast Week",
      ...EIGHT_INPUT_GRADES,
      "All Grades",
    ],
    Array.from(
      { length: 4 },
      (_, index) => {
        const values =
          reports.map(
            (report) =>
              report.weeks[index]
                .expected
          );

        const total =
          values.reduce(
            (sum, value) =>
              sum + value,
            0
          );

        return [
          formatWeek(
            reports[0]
              .weeks[index]
              .week
          ),
          ...values.map(formatKg),
          formatKg(total),
        ];
      }
    ),
    y
  );

  y = addPdfParagraph(
    doc,
    "The following sections contain complete " +
    "individual tea-grade reports, including recorded " +
    "factory inputs, demand forecasts, alerts, and recommendations.",
    y
  );

  for (const report of reports) {
    addPdfGradeReport(
      doc,
      report,
      true
    );
  }

  addPdfPageNumbers(doc);

  doc.save(
    `tea_demand_complete_${origin}_revision_${revision}.pdf`
  );
}

export default function DemandReports() {
  const [
    origin,
    setOrigin,
  ] = useState(
    () => getLatestCompletedWeek()
  );

  const [
    revision,
    setRevision,
  ] = useState(null);

  const [
    forecasts,
    setForecasts,
  ] = useState(null);

  const [
    observations,
    setObservations,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    downloading,
    setDownloading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    observationWarning,
    setObservationWarning,
  ] = useState("");

  const [
    downloadError,
    setDownloadError,
  ] = useState("");

  const requestId = useRef(0);

  const loadReports = useCallback(
    async () => {
      const request =
        ++requestId.current;

      const latestWeek =
        getLatestCompletedWeek();

      setOrigin(latestWeek);
      setLoading(true);
      setError("");
      setDownloadError("");
      setObservationWarning("");
      setRevision(null);
      setForecasts(null);
      setObservations([]);

      try {
        const latest =
          await fetchLatestRevision(
            latestWeek
          );

        if (
          request !== requestId.current
        ) {
          return;
        }

        setRevision(
          latest.revision
        );

        setForecasts(
          latest.forecasts
        );

        try {
          const result =
            await getEightInputHistoricalWeek(
              latestWeek
            );

          if (
            request !== requestId.current
          ) {
            return;
          }

          const records =
            extractRecords(result);

          setObservations(records);

          if (
            !EIGHT_INPUT_GRADES.every(
              (grade) =>
                records.some(
                  (item) =>
                    (
                      item.tea_type ||
                      item.grade
                    ) === grade
                )
            )
          ) {
            setObservationWarning(
              "Some recorded factory data is unavailable. " +
              "Missing values will be shown as unavailable."
            );
          }
        } catch {
          if (
            request !== requestId.current
          ) {
            return;
          }

          setObservations([]);

          setObservationWarning(
            "Recorded factory data could not be loaded. " +
            "The saved forecasts remain available for reporting."
          );
        }
      } catch (caughtError) {
        if (
          request !== requestId.current
        ) {
          return;
        }

        setError(
          getErrorMessage(caughtError)
        );
      } finally {
        if (
          request === requestId.current
        ) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadReports();

    return () => {
      requestId.current += 1;
    };
  }, [loadReports]);

  const reports = useMemo(() => {
    if (
      !forecasts ||
      revision === null
    ) {
      return [];
    }

    return EIGHT_INPUT_GRADES.map(
      (grade) => {
        const observation =
          observations.find(
            (item) =>
              (
                item.tea_type ||
                item.grade
              ) === grade
          ) || null;

        return buildGradeReport(
          grade,
          forecasts[grade],
          observation,
          origin,
          revision
        );
      }
    );
  }, [
    forecasts,
    observations,
    origin,
    revision,
  ]);

  function handleDownloadGrade(report) {
    setDownloadError("");
    setDownloading(true);

    try {
      downloadGradePdf(report);
    } catch (caughtError) {
      setDownloadError(
        getErrorMessage(caughtError)
      );
    } finally {
      setDownloading(false);
    }
  }

  function handleDownloadComplete() {
    if (
      reports.length !==
      EIGHT_INPUT_GRADES.length
    ) {
      return;
    }

    setDownloadError("");
    setDownloading(true);

    try {
      downloadCompletePdf(
        reports,
        origin,
        revision
      );
    } catch (caughtError) {
      setDownloadError(
        getErrorMessage(caughtError)
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="demand-page"
      style={{
        minHeight: "100vh",
        background: COLORS.ivory,
        paddingBottom: 40,
      }}
    >
      <div
        className="demand-page-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1>Demand Reports</h1>

          <p
            style={{
              color: COLORS.muted,
              margin: "7px 0 0",
            }}
          >
            Reporting Week:{" "}
            {formatWeek(origin)}
            {revision !== null &&
              ` · ${
                revision === 0
                  ? "Original Forecast"
                  : `Revision ${revision}`
              }`}
          </p>
        </div>

        <button
          type="button"
          className="demand-secondary-btn"
          onClick={loadReports}
          disabled={loading}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {loading && (
        <p
          style={{
            color: COLORS.muted,
          }}
        >
          Loading saved forecasts
          and factory reports...
        </p>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="demand-error-message"
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <AlertTriangle
            size={19}
          />
          {error}
        </div>
      )}

      {downloadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 10,
            color: COLORS.danger,
            marginBottom: 20,
          }}
        >
          <AlertTriangle
            size={19}
          />
          {downloadError}
        </div>
      )}

      {!loading &&
        !error &&
        reports.length ===
          EIGHT_INPUT_GRADES.length && (
          <>
            {observationWarning && (
              <div
                role="alert"
                style={{
                  padding: 15,
                  borderRadius: 10,
                  marginBottom: 18,
                  background: "#FFF8EB",
                  color: COLORS.warning,
                }}
              >
                {observationWarning}
              </div>
            )}

            <Panel
              title="Complete Demand Report"
              icon={Files}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <p
                  style={{
                    color: COLORS.muted,
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  Download one complete PDF
                  containing all five tea
                  grades, recorded factory
                  information, forecasts,
                  alerts, and recommendations.
                </p>

                <button
                  type="button"
                  className="report-download-btn"
                  disabled={downloading}
                  onClick={
                    handleDownloadComplete
                  }
                >
                  <Download size={18} />
                  Download Complete Report
                </button>
              </div>
            </Panel>

            <Panel
              title="Individual Tea Grade Reports"
              icon={FileText}
            >
              <p
                style={{
                  color: COLORS.muted,
                  marginTop: 0,
                  marginBottom: 16,
                }}
              >
                Review each tea grade's report
                below or download it separately
                as a PDF.
              </p>
            </Panel>

            {reports.map((report) => (
              <GradeReport
                key={report.grade}
                report={report}
                downloading={
                  downloading
                }
                onDownload={() =>
                  handleDownloadGrade(
                    report
                  )
                }
              />
            ))}
          </>
        )}
    </div>
  );
}
