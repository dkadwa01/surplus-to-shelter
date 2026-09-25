# Surplus-to-Shelter

## Overview

A hackathon prototype for connecting surplus food donors with verified recipient organizations. It supports individual and business food listings, community collections, recipient discovery, verification, on-demand matching, and a role-aware impact dashboard.

## Main Features

- Donor accounts for households, caterers, restaurants, and food businesses
- Donation listing, editing, and cancellation
- Recipient organization profiles and discovery
- Participant verification and administrator review
- Community and collective donations with target progress
- On-demand donation-to-recipient match suggestions
- Location search, map previews, and location-aware matching
- Role-based dashboard summaries
- Driver accounts are supported. Driver dispatch, delivery tracking, and delivered-food statistics are not implemented in this checkout.

## Technology Stack

Frontend: React 18, Vite, TypeScript, vanilla CSS, Leaflet, and OpenStreetMap.

Backend: Node.js, Express, TypeScript, Prisma, SQLite, and Zod. Shared TypeScript/Zod contracts live in `src/shared`.

## Project Structure

- `src/frontend` - React application, feature pages, components, and styling
- `src/backend` - Express API, feature modules, middleware, and services
- `src/shared` - contracts and types shared by both apps
- `database` - Prisma schema, migrations, and local SQLite setup
- `DOCS` - architecture, API, backend, frontend, and database notes

## Running Locally

Use Node.js 20+ and npm 10+. From the repository root:

```sh
npm install
```

Copy `.env.example` to `.env`, then generate the Prisma client and apply migrations:

```sh
cp .env.example .env
npm run prisma:generate
npm run db:deploy
```

On Windows PowerShell, use `Copy-Item .env.example .env` for the copy step. Start both apps from the repository root:

```sh
npm run dev
```

The frontend is at `http://localhost:5173`; the API is at `http://localhost:4000`. To start one side separately, use `npm run dev:frontend` or `npm run dev:backend` from the root. These workspace scripts build the shared package first; running `npm run dev` from inside either workspace is not the supported setup.

Other useful root commands are `npm run typecheck`, `npm run build`, `npm run prisma:validate`, and `npm test`.

## Main User Flows

Donor flow: create an account, list surplus food, review current match suggestions, and coordinate directly with a recipient. Match results are suggestions; they do not reserve food.

Community flow: multiple donors contribute items to a collection, the organizer reviews target progress and match suggestions, and participants coordinate fulfillment. Dispatch and delivery tracking are not present in this checkout.

## Location and Maps

The app uses Leaflet with OpenStreetMap tiles and attribution. Donation and recipient forms let users explicitly search a typed address or landmark through the authenticated backend location endpoint, which queries OpenStreetMap Nominatim and returns selectable results with coordinates. Search results are cached in memory; search happens on submit rather than as-you-type autocomplete to follow the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). If lookup fails, a valid manually entered address can still be saved without coordinates. Browser geolocation is not implemented. Where both locations have coordinates, distance is an approximate straight-line Haversine estimate, not a driving route.

Set `LOCATION_SEARCH_URL` in `.env` to the Nominatim-compatible search endpoint if the location provider needs to be changed. The default is the public OpenStreetMap Nominatim service, intended here for moderate, user-initiated hackathon demo use.

## Prototype Note

This is a hackathon prototype. Matching is calculated on demand; dispatch, delivery records, notification workflows, and production service infrastructure require further development. The local SQLite database is for development and demonstration.
