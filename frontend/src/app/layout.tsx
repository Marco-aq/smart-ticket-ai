import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Smart Ticket AI | Support intelligence",
  description:
    "A machine learning portfolio demo for classifying and managing synthetic support tickets.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
