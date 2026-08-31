const { useEffect, useMemo, useState } = React;

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const api = (url, options) => fetch(url, { headers: { "Content-Type": "application/json" }, ...options }).then(async response => {
  if (!response.ok) throw new Error(await response.text());
  return response.json();
});

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
    React.createElement("div", { className: "app" },
      React.createElement("header", { className: "topbar" },
        React.createElement("div", { className: "brand" },
          React.createElement("h1", null, "Gestor de Cotizaciones"),
          React.createElement("p", null, "Productos, proveedores, clientes, PDF, estados e historial")
        ),
        React.createElement("nav", { className: "tabs" },
          ["quotes", "products", "suppliers", "clients"].map(item =>
            React.createElement("button", { key: item, className: `tab ${tab === item ? "active" : ""}`, onClick: () => setTab(item) }, label(item))
          )
        )
      ),
      React.createElement("main", { className: "layout" },
        React.createElement("section", { className: "main" },
          error && React.createElement("div", { className: "panel" }, error),
          React.createElement(Metrics, { summary: data.summary }),
          tab === "quotes" && React.createElement(Quotes, { quotes: data.quotes, setStatus }),
          tab === "products" && React.createElement(ProductList, { products: data.products }),
          tab === "suppliers" && React.createElement(PartyList, { title: "Proveedores", parties: data.suppliers }),
          tab === "clients" && React.createElement(PartyList, { title: "Clientes", parties: data.clients })
        ),
        React.createElement("aside", { className: "side" },
          React.createElement(NewQuoteForm, { clients: data.clients, products: data.products, onSubmit: createQuote })
        )
      )
    )
  );
}

function Metrics({ summary }) {
  return React.createElement("div", { className: "metrics" },
    [["Cotizaciones", summary.quotes], ["Pendientes", summary.pending], ["Aprobadas", summary.approved], ["Productos", summary.products]].map(([name, value]) =>
      React.createElement("div", { className: "metric", key: name }, React.createElement("span", null, name), React.createElement("strong", null, value ?? 0))
    )
  );
}

function Quotes({ quotes, setStatus }) {
  return React.createElement("div", { className: "quote-list" },
    quotes.map(quote => React.createElement("article", { className: "quote", key: quote.id },
      React.createElement("div", { className: "quote-head" },
        React.createElement("div", null,
          React.createElement("h3", null, `${quote.number} · ${quote.clientName}`),
          React.createElement("div", { className: "muted" }, `Valida hasta ${new Date(quote.validUntil).toLocaleDateString("es-CL")}`)
        ),
        React.createElement("span", { className: `status ${quote.status}` }, quote.status)
      ),
      React.createElement("table", null,
        React.createElement("thead", null, React.createElement("tr", null, ["SKU", "Producto", "Cant.", "Total"].map(h => React.createElement("th", { key: h }, h)))),
        React.createElement("tbody", null, quote.items.map(item => React.createElement("tr", { key: `${quote.id}-${item.productId}` },
          React.createElement("td", null, item.sku),
          React.createElement("td", null, item.productName),
          React.createElement("td", null, item.quantity),
          React.createElement("td", null, money.format(item.total))
        )))
      ),
      React.createElement("strong", null, `Total ${money.format(quote.total)}`),
      React.createElement("div", { className: "actions" },
        ["Sent", "Approved", "Rejected", "Expired"].map(status =>
          React.createElement("button", { className: "ghost", key: status, onClick: () => setStatus(quote, status) }, status)
        ),
        React.createElement("a", { className: "primary", href: `/api/quotes/${quote.id}/pdf` }, "PDF")
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
  return React.createElement("section", { className: "panel" },
    React.createElement("h2", null, "Productos"),
    products.map(product => React.createElement("div", { className: "row", key: product.id },
      React.createElement("div", null, React.createElement("strong", null, product.name), React.createElement("div", { className: "muted" }, `${product.sku} · ${product.supplierName}`)),
      React.createElement("strong", null, money.format(product.unitPrice))
    ))
  );
}

function PartyList({ title, parties }) {
  return React.createElement("section", { className: "panel" },
    React.createElement("h2", null, title),
    parties.map(party => React.createElement("div", { className: "row", key: party.id },
      React.createElement("div", null, React.createElement("strong", null, party.name), React.createElement("div", { className: "muted" }, party.email)),
      React.createElement("span", { className: "muted" }, party.phone)
    ))
  );
}

function NewQuoteForm({ clients, products, onSubmit }) {
  const defaultDate = useMemo(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), []);
  return React.createElement("section", { className: "panel" },
    React.createElement("h2", null, "Nueva cotizacion"),
    React.createElement("form", { className: "form", onSubmit },
      React.createElement("div", { className: "field" },
        React.createElement("label", null, "Cliente"),
        React.createElement("select", { name: "clientId", required: true }, clients.map(client => React.createElement("option", { value: client.id, key: client.id }, client.name)))
      ),
      React.createElement("div", { className: "field" },
        React.createElement("label", null, "Valida hasta"),
        React.createElement("input", { name: "validUntil", type: "date", defaultValue: defaultDate, required: true })
      ),
      products.map(product => React.createElement("div", { className: "line", key: product.id },
        React.createElement("div", null, React.createElement("strong", null, product.name), React.createElement("div", { className: "muted" }, money.format(product.unitPrice))),
        React.createElement("input", { name: `qty-${product.id}`, type: "number", min: "0", placeholder: "0" })
      )),
      React.createElement("button", { className: "primary", type: "submit" }, "Crear cotizacion")
    )
  );
}

function label(tab) {
  return ({ quotes: "Cotizaciones", products: "Productos", suppliers: "Proveedores", clients: "Clientes" })[tab];
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
