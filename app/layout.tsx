import type { Metadata } from "next";
import "./globals.css";
import WalletAuthProvider from "./WalletAuthProvider";

export const metadata: Metadata = {
  title: "Grandstone Wallet",
  description: "A secure, AI-assisted financial platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><WalletAuthProvider>{children}</WalletAuthProvider></body>
    </html>
  );
}
