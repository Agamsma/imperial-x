import type { Metadata } from "next";
import DemoDashboard from "./DemoDashboard";

export const metadata: Metadata = {
  title: "Demo | VajraNow",
  description: "Illustrative VajraNow dashboard with synthetic data. Not a real forecast.",
};

export default function DemoPage() {
  return <DemoDashboard />;
}
