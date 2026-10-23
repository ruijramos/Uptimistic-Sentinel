# Uptimistic-Sentinel Frontend

Modern single-page application built with **Angular 18**, leveraging Standalone Components, Signals for reactive state management, and Reactive Forms.

## Tech Stack & Architecture

- **Angular 18 Standalone Components:** Modular, boilerplate-free architecture with no NgModules.
- **State Management:** Reactive store powered by Angular Signals (`signal`, `computed`, `effect`) in `TargetStateService`.
- **Dynamic Micro-Graphics:** Lightweight, zero-dependency inline SVG Sparkline charts showing 24-hour latency trends.
- **Styling:** Custom Vanilla CSS Design System with dark mode, glassmorphism, pulse indicators, and responsive layouts.
- **Proxying:** Built-in development proxy forwarding `/api/*` to the Flask backend at `http://localhost:5000`.

## Directory Structure

```text
src/app/
├── core/
│   ├── models/           # Target, CheckLog, SystemSettings interfaces
│   └── services/         # ApiService (HTTP client), TargetStateService (Signals store)
├── shared/
│   └── components/       # SparklineChartComponent, StatusBadgeComponent
└── features/
    ├── dashboard/        # Main monitoring view, metric cards, targets table
    ├── target-form/      # Reactive form modal for adding/editing targets
    ├── target-detail/    # Detail modal with check logs and alert history
    └── settings/         # Dynamic operational settings & SMTP test modal
```

## Development

```bash
npm install
npm start
```

Access the development server at `http://localhost:4200/`.
