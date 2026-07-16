import "./globals.css";

export const metadata = {
  title: "PR Review Dashboard",
  description: "Automated code review results for PolicyManagementSPFx",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav style={{ display: "flex", gap: 16, padding: "16px 24px", borderBottom: "1px solid #333" }}>
          <a href="/">Reviews</a>
          <a href="/settings">Settings</a>
        </nav>
        <main style={{ padding: "24px" }}>{children}</main>
      </body>
    </html>
  );
}
