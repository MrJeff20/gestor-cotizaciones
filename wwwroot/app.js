const { useEffect, useMemo, useState } = React;

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const api = (url, options) => fetch(url, { headers: { "Content-Type": "application/json" }, ...options }).then(async response => {
  if (!response.ok) throw new Error(await response.text());
  return response.json();
});

const tabs = [
  { id: "quotes", label: "Cotizaciones", icon: "C" },
  { id: "products", label: "Productos", icon: "P" },
  { id: "suppliers", label: "Proveedores", icon: "V" },
  { id: "clients", label: "Clientes", icon: "L" }
];

function App() {
  const [tab, setTab] = useState("quotes");
  const [data, setData] = useState({ products: [], suppliers: [], clients: [], quotes: [], summary: {} });
  const [error, setError] = useState("");

  const load = async () => {
    const [products, suppliers, clients, quotes, summary] = await Promise.all([
      api("/api/products"),
      api("/api/suppliers"),
      api("/api/clients"),
      api("/api/quotes"),
      api("/api/summary")
    ]);
    setData({ products, suppliers, clients, quotes, summary });
  };

  useEffect(() => { load().catch(err => setError(err.message)); }, []);

  const createQuote = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = data.products
      .map(product => ({ productId: product.id, quantity: Number(form.get(`qty-${product.id}`) || 0) }))
      .filter(item => item.quantity > 0);

    await api("/api/quotes", {
      method: "POST",
      body: JSON.stringify({
        clientId: Number(form.get("clientId")),
        validUntil: form.get("validUntil"),
        items
      })
    });
    event.currentTarget.reset();
    await load();
  };

  const setStatus = async (quote, status) => {
    await api(`/api/quotes/${quote.id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, note: `Actualizado desde tablero a ${status}.` })
    });
    await load();
  };

  return (
    React.createElement("div", { className: "app-shell" },
      React.createElement("aside", { className: "sidebar" },
        React.createElement("div", { className: "brand" },
          React.createElement("div", { className: "brand-mark", "aria-hidden": "true" }, "GC"),
          React.createElement("div", null,
            React.createElement("h1", null, "Gestor"),
            React.createElement("p", null, "Cotizaciones")
          )
        ),
        React.createElement("nav", { className: "tabs", "aria-label": "Secciones" },
          tabs.map(item =>
            React.createElement("button", {
              key: item.id,
              className: `tab ${tab === item.id ? "active" : ""}`,
              onClick: () => setTab(item.id)
            },
              React.createElement("span", { className: "tab-icon", "aria-hidden": "true" }, item.icon),
              item.label
            )
          )
        ),
        React.createElement("div", { className: "sidebar-note" },
          React.createElement("span", null, "Pipeline activo"),
          React.createElement("strong", null, `${data.summary.pending ?? 0} pendientes`)
        )
      ),
      React.createElement("main", { className: "workspace" },
        React.createElement("header", { className: "page-header" },
          React.createElement("div", null,
            React.createElement("span", { className: "eyebrow" }, "Panel comercial"),
            React.createElement("h2", null, titleFor(tab)),
            React.createElement("p", null, "Administra clientes, productos, proveedores y cotizaciones desde una sola vista.")
          ),
          React.createElement("a", { className: "header-action", href: "https://github.com/MrJeff20/gestor-cotizaciones", target: "_blank", rel: "noreferrer" }, "Repositorio")
        ),
        error && React.createElement("div", { className: "alert" }, error),
        React.createElement(Metrics, { summary: data.summary }),
        React.createElement("div", { className: "content-grid" },
          React.createElement("section", { className: "main-panel" },
            tab === "quotes" && React.createElement(Quotes, { quotes: data.quotes, setStatus }),
            tab === "products" && React.createElement(ProductList, { products: data.products }),
            tab === "suppliers" && React.createElement(PartyList, { parties: data.suppliers }),
            tab === "clients" && React.createElement(PartyList, { parties: data.clients })
          ),
          React.createElement("aside", { className: "side-panel" },
            React.createElement(NewQuoteForm, { clients: data.clients, products: data.products, onSubmit: createQuote })
          )
        )
      )
    )
  );
}

function Metrics({ summary }) {
  const items = [
    ["Cotizaciones", summary.quotes, "Total emitidas"],
    ["Pendientes", summary.pending, "Por gestionar"],
    ["Aprobadas", summary.approved, "Cierre comercial"],
    ["Productos", summary.products, "Catalogo activo"]
  ];
  return React.createElement("section", { className: "metrics", "aria-label": "Resumen" },
    items.map(([name, value, caption]) =>
      React.createElement("article", { className: "metric", key: name },
        React.createElement("span", null, name),
        React.createElement("strong", null, value ?? 0),
        React.createElement("small", null, caption)
      )
    )
  );
}

function Quotes({ quotes, setStatus }) {
  return React.createElement("div", { className: "quote-list" },
    quotes.map(quote => React.createElement("article", { className: "quote", key: quote.id },
      React.createElement("div", { className: "quote-head" },
        React.createElement("div", null,
          React.createElement("span", { className: "quote-number" }, quote.number),
          React.createElement("h3", null, quote.clientName),
          React.createElement("div", { className: "muted" }, `Valida hasta ${new Date(quote.validUntil).toLocaleDateString("es-CL")}`)
        ),
        React.createElement("div", { className: "quote-total" },
          React.createElement("span", { className: `status ${quote.status}` }, statusLabel(quote.status)),
          React.createElement("strong", null, money.format(quote.total))
        )
      ),
      React.createElement("div", { className: "table-wrap" },
        React.createElement("table", null,
          React.createElement("thead", null, React.createElement("tr", null, ["SKU", "Producto", "Cant.", "Total"].map(h => React.createElement("th", { key: h }, h)))),
          React.createElement("tbody", null, quote.items.map(item => React.createElement("tr", { key: `${quote.id}-${item.productId}` },
            React.createElement("td", null, item.sku),
            React.createElement("td", null, item.productName),
            React.createElement("td", null, item.quantity),
            React.createElement("td", null, money.format(item.total))
          )))
        )
      ),
      React.createElement("div", { className: "quote-footer" },
        React.createElement("div", { className: "actions" },
          ["Sent", "Approved", "Rejected", "Expired"].map(status =>
            React.createElement("button", { className: "ghost", key: status, onClick: () => setStatus(quote, status) }, statusLabel(status))
          )
        ),
        React.createElement("a", { className: "primary", href: `/api/quotes/${quote.id}/pdf` }, "Descargar PDF")
      ),
      React.createElement("ol", { className: "history" }, quote.history.map((event, index) =>
        React.createElement("li", { key: index },
          React.createElement("strong", null, event.title),
          React.createElement("div", { className: "muted" }, event.detail)
        )
      ))
    ))
  );
}

function ProductList({ products }) {
  return React.createElement("section", { className: "panel-list" },
    products.map(product => React.createElement("article", { className: "data-row", key: product.id },
      React.createElement("div", { className: "avatar", "aria-hidden": "true" }, product.sku.slice(0, 2)),
      React.createElement("div", { className: "row-main" },
        React.createElement("strong", null, product.name),
        React.createElement("span", null, `${product.sku} - ${product.supplierName}`)
      ),
      React.createElement("strong", { className: "row-value" }, money.format(product.unitPrice))
    ))
  );
}

function PartyList({ parties }) {
  return React.createElement("section", { className: "panel-list" },
    parties.map(party => React.createElement("article", { className: "data-row", key: party.id },
      React.createElement("div", { className: "avatar", "aria-hidden": "true" }, initials(party.name)),
      React.createElement("div", { className: "row-main" },
        React.createElement("strong", null, party.name),
        React.createElement("span", null, party.email)
      ),
      React.createElement("span", { className: "row-value muted" }, party.phone)
    ))
  );
}

function NewQuoteForm({ clients, products, onSubmit }) {
  const defaultDate = useMemo(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), []);
  return React.createElement("section", { className: "composer" },
    React.createElement("div", { className: "section-title" },
      React.createElement("span", { className: "eyebrow" }, "Rapido"),
      React.createElement("h3", null, "Nueva cotizacion")
    ),
    React.createElement("form", { className: "form", onSubmit },
      React.createElement("div", { className: "field" },
        React.createElement("label", { htmlFor: "clientId" }, "Cliente"),
        React.createElement("select", { id: "clientId", name: "clientId", required: true }, clients.map(client => React.createElement("option", { value: client.id, key: client.id }, client.name)))
      ),
      React.createElement("div", { className: "field" },
        React.createElement("label", { htmlFor: "validUntil" }, "Valida hasta"),
        React.createElement("input", { id: "validUntil", name: "validUntil", type: "date", defaultValue: defaultDate, required: true })
      ),
      React.createElement("div", { className: "product-picker" },
        products.map(product => React.createElement("label", { className: "line", key: product.id },
          React.createElement("span", null,
            React.createElement("strong", null, product.name),
            React.createElement("small", null, money.format(product.unitPrice))
          ),
          React.createElement("input", { name: `qty-${product.id}`, type: "number", min: "0", placeholder: "0", "aria-label": `Cantidad de ${product.name}` })
        ))
      ),
      React.createElement("button", { className: "primary wide", type: "submit" }, "Crear cotizacion")
    )
  );
}

function titleFor(tab) {
  return ({ quotes: "Cotizaciones", products: "Catalogo de productos", suppliers: "Proveedores", clients: "Clientes" })[tab];
}

function statusLabel(status) {
  return ({ Draft: "Borrador", Sent: "Enviada", Approved: "Aprobada", Rejected: "Rechazada", Expired: "Vencida" })[status] ?? status;
}

function initials(name) {
  return name.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
