"use client";

import dynamic from "next/dynamic";

/* La bibliothèque de graphiques ne se télécharge qu'au moment où un accueil affiche un graphique : la première image de l'accueil reste légère.
   Pendant le chargement, une zone de la même hauteur évite que la page saute. */
const Loading = () => <div className="space-chart__plot space-chart__plot--loading" role="status"><span className="sr-only">Chargement du graphique…</span></div>;
const options = { ssr: false, loading: Loading } as const;

export const BarsChart = dynamic(() => import("./DashboardCharts").then((module) => module.BarsChart), options);
export const AreaCountChart = dynamic(() => import("./DashboardCharts").then((module) => module.AreaCountChart), options);
export const DonutChart = dynamic(() => import("./DashboardCharts").then((module) => module.DonutChart), options);
export const MeasurementLine = dynamic(() => import("./DashboardCharts").then((module) => module.MeasurementLine), options);
