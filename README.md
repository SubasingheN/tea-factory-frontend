# AI-Powered Tea Factory Management System

## Tea Demand Forecasting Component

This repository contains the frontend of the AI-Powered Tea Factory Management System. The Tea Demand Forecasting component is designed to help tea factories estimate future demand using historical factory, market, and environmental information.

The component uses a Temporal Fusion Transformer (TFT) model through the FastAPI backend to generate demand forecasts for the next four weeks.

---

## Research Project

**Project ID:** RP26-IT-171

**Research Component:**  
Design and Implementation of an Explainable AI-Based Tea Demand Forecasting System Using Temporal Fusion Transformer (TFT)

---

## Main Objective

The main objective of this component is to provide an explainable weekly tea demand forecasting system that supports tea factories in production and inventory planning.

The system forecasts demand for the following five tea types:

- BOP
- BOPF
- Dust
- OP
- Pekoe

---

## Main Features

### Weekly Data Entry

Users enter information for the latest fully completed Monday-to-Sunday week.

The weekly input includes:

- Demand
- Production
- Inventory
- Colombo auction price
- Rainfall index
- USD/LKR exchange rate
- Festival status
- Global commodity shock

The same weekly data entry is provided for all five supported tea types.

### Four-Week Demand Forecast

After weekly data is entered, the trained TFT model generates demand forecasts for:

- Current week
- Week 2
- Week 3
- Week 4

For each tea type and forecast week, the system provides:

- Expected demand
- Lower forecast value
- Upper forecast value

The lower and upper values provide a forecast range instead of presenting only a single demand value.

### Alerts and Recommendations

The system evaluates forecast demand and identifies:

- Low demand
- Normal demand
- High demand

Recommendations are then generated to support production and inventory planning.

### Why This Forecast?

The explainability section helps users understand which groups of input variables had greater influence on the TFT forecast.

The explanation is based on the trained TFT model's variable importance and interpretation information.

The displayed importance represents model influence and should not be interpreted as proof of causation.

### Forecast History

Generated forecasts can be saved and reviewed later.

Users can view:

- Previous forecast periods
- Forecast values
- Expected demand ranges
- Tea types
- Forecast comparisons when actual demand data is available

### PDF Reports

Users can download a PDF report containing the generated four-week tea demand forecast.

---

## Weekly Forecasting Workflow

The system follows this operational workflow:

1. Wait until a Monday-to-Sunday week is fully completed.
2. Enter actual factory, market, and environmental data for that completed week.
3. Save the weekly data.
4. Generate the demand forecast.
5. Forecast demand for the ongoing week and the following three weeks.
6. Review alerts and recommendations.
7. Review the explanation of the forecast.
8. Save and review forecast history.
9. Download the PDF forecast report.

Example:

If weekly data is entered on Monday, 31 August 2026:

- Input week: 24 August 2026 - 30 August 2026
- Forecast Week 1: 31 August 2026
- Forecast Week 2: 7 September 2026
- Forecast Week 3: 14 September 2026
- Forecast Week 4: 21 September 2026

---

## Machine Learning Model

The demand forecasting component uses a trained Temporal Fusion Transformer (TFT).

The model was developed for multi-series weekly forecasting across the five supported tea types.

The forecasting model uses historical demand together with production, inventory, market, environmental, seasonal, lag, and rolling-average information.

### Model Evaluation

The trained model was evaluated on held-out test data.

| Metric | Result |
|---|---:|
| MAE | 527.02 |
| RMSE | 767.23 |
| R² | 0.88715 |

The final system uses the saved trained TFT model checkpoint for forecasting.

---

## Dataset

The research dataset contains weekly records covering five tea types.

Important data categories include:

- Tea type
- Historical demand
- Production
- Inventory
- Colombo auction price
- Auction price lag features
- Rainfall
- USD/LKR exchange rate
- Festival information
- Global commodity shock
- Seasonal features
- Demand rolling averages

The research dataset is kept separate from normal operational weekly input. New operational input does not directly modify the original research dataset.

---

## Technology Stack

### Frontend

- React
- Vite
- React Router
- Recharts
- Lucide React
- JavaScript
- CSS

### Backend

- Python
- FastAPI
- Uvicorn
- Pandas
- PyTorch
- PyTorch Forecasting
- Lightning
- Scikit-learn
- ReportLab

### Database

- MongoDB Atlas

MongoDB is used to persist operational weekly inputs and generated forecast history.

---

## Frontend Pages

The Tea Demand Forecasting component contains the following user-facing pages:

- Home
- Weekly Data Entry
- Demand Forecast
- Alerts & Recommendations
- Why This Forecast?
- Forecast History
- Reports

---

## Backend Connection

During local development, the frontend communicates with the FastAPI backend at:

```text
http://127.0.0.1:8000
```

The backend must be running before using forecasting features.

---

## Running the Frontend

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

The frontend is normally available at:

```text
http://localhost:5173
```

### 3. Create a production build

```bash
npm run build
```

---

## Running the Backend

Activate the Python virtual environment and start FastAPI:

```bash
uvicorn app.main:app --reload
```

The API is normally available at:

```text
http://127.0.0.1:8000
```

FastAPI Swagger documentation is available at:

```text
http://127.0.0.1:8000/docs
```

---

## Important Notes

- The system forecasts exactly four weeks.
- Five tea types are currently supported.
- Weekly input should represent a fully completed week.
- Operational weekly input is stored separately from the original research dataset.
- The trained TFT model is used for forecasting; normal weekly forecasting does not retrain the model.
- Forecast values are predictions and should support, rather than completely replace, human planning decisions.

---

## Current Status

The Tea Demand Forecasting component currently supports the complete workflow from weekly data entry through forecasting, alerts, recommendations, explainability, forecast history, persistence, and PDF report generation.

The frontend and backend have been tested together for the complete weekly forecasting workflow.