import type { Metadata } from "next";
import DemoApp from "./DemoApp";

export const metadata: Metadata = {
  title: "Demo | VajraNow",
  description: "VajraNow dashboard running the nowcasting engine on synthetic storms. Not a real forecast.",
};

export default function DemoPage() {
  return <DemoApp />;
}
