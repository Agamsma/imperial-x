import type { Metadata } from "next";
import DemoApp from "./DemoApp";

export const metadata: Metadata = {
  title: "Demo | Imperial-X",
  description: "Imperial-X dashboard running the nowcasting engine on synthetic storms. Not a real forecast.",
};

export default function DemoPage() {
  return <DemoApp />;
}
