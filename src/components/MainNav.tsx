import Link from "next/link";

const navItems = [
  { href: "/", label: "Start" },
  { href: "/ergebnisse", label: "Aktuelle Ergebnisse" },
  { href: "/duelle", label: "Top Begegnungen" },
  { href: "/turniere", label: "Turniere" },
  { href: "/impressum", label: "Impressum" },
];

export default function MainNav() {
  return (
    <header
      style={{
        width: "100%",
        background: "rgba(255, 255, 255, 0.96)",
        borderBottom: "1px solid #e5e7eb",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <nav
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: "18px",
            fontWeight: 800,
            color: "#102018",
            textDecoration: "none",
            marginRight: "10px",
          }}
        >
          TNB Herren Live
        </Link>

        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "999px",
              background: "#ffffff",
              color: "#24352c",
              fontSize: "14px",
              fontWeight: 650,
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
