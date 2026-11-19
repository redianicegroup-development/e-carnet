"use client";

import dynamic from "next/dynamic";

/* La bibliothèque de graphiques ne se télécharge qu'au moment où un accueil affiche un graphique : la première image de l'accueil reste légère.
   Pendant le chargement, une zone de la même hauteur évite que la page saute. */
const Loading = () => <div className="space-chart__plot space-chart__plot--loading" role="status"><span className="sr-only">Chargement du graphique…</span></div>;
/* Next.js lit les options de dynamic() à la compilation : elles doivent être écrites directement dans l'appel (objet littéral), pas passées via une variable. */

export const BarsChart = dynamic(() => import("./DashboardCharts").then((module) => module.BarsChart), { ssr: false, loading: Loading });
export const AreaCountChart = dynamic(() => import("./DashboardCharts").then((module) => module.AreaCountChart), { ssr: false, loading: Loading });
export const DonutChart = dynamic(() => import("./DashboardCharts").then((module) => module.DonutChart), { ssr: false, loading: Loading });
export const MeasurementLine = dynamic(() => import("./DashboardCharts").then((module) => module.MeasurementLine), { ssr: false, loading: Loading });
