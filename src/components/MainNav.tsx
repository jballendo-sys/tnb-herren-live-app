export function MainNav() {
  const links = [
    { href: "/", label: "Start" },
    { href: "/analysen", label: "Analysen" },
  { href: "/ergebnisse", label: "Aktuelle Ergebnisse" },
    { href: "/ergebnisse", label: "Aktuelle Ergebnisse" },
  { href: "/duelle", label: "Top Begegnungen" },
    { href: "/turniere", label: "Turniere" },
    { href: "/impressum", label: "Impressum" }
  ];

  return (
    <nav
      aria-label="Hauptnavigation"
      className="card"
      style={{
        marginTop: 18,
        marginBottom: 22,
        padding: 14,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center"
      }}
    >
      {links.map((link) => (
        <a
          key={link.href}
          className="badge"
          href={link.href}
          style={{ textDecoration: "none", fontWeight: 900 }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
