using System.Text;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

var store = DemoStore.Create();

app.MapGet("/api/summary", () => Results.Ok(new
{
    products = store.Products.Count,
    suppliers = store.Suppliers.Count,
    clients = store.Clients.Count,
    quotes = store.Quotes.Count,
    pending = store.Quotes.Count(q => q.Status == QuoteStatus.Draft || q.Status == QuoteStatus.Sent),
    approved = store.Quotes.Count(q => q.Status == QuoteStatus.Approved)
}));

app.MapGet("/api/products", () => Results.Ok(store.Products));
app.MapPost("/api/products", (ProductInput input) =>
{
    var supplier = store.Suppliers.FirstOrDefault(s => s.Id == input.SupplierId);
    if (supplier is null) return Results.BadRequest("Proveedor no encontrado.");

    var product = new Product(store.NextProductId(), input.Sku.Trim(), input.Name.Trim(), supplier.Id, supplier.Name, input.UnitPrice);
    store.Products.Add(product);
    return Results.Created($"/api/products/{product.Id}", product);
});

app.MapGet("/api/suppliers", () => Results.Ok(store.Suppliers));
app.MapPost("/api/suppliers", (PartyInput input) =>
{
    var supplier = new Supplier(store.NextSupplierId(), input.Name.Trim(), input.Email.Trim(), input.Phone.Trim());
    store.Suppliers.Add(supplier);
    return Results.Created($"/api/suppliers/{supplier.Id}", supplier);
});

app.MapGet("/api/clients", () => Results.Ok(store.Clients));
app.MapPost("/api/clients", (PartyInput input) =>
{
    var client = new Client(store.NextClientId(), input.Name.Trim(), input.Email.Trim(), input.Phone.Trim());
    store.Clients.Add(client);
    return Results.Created($"/api/clients/{client.Id}", client);
});

app.MapGet("/api/quotes", () => Results.Ok(store.Quotes.OrderByDescending(q => q.CreatedAt)));
app.MapPost("/api/quotes", (QuoteInput input) =>
{
    var client = store.Clients.FirstOrDefault(c => c.Id == input.ClientId);
    if (client is null) return Results.BadRequest("Cliente no encontrado.");
    if (input.Items.Count == 0) return Results.BadRequest("Agrega al menos un producto.");

    var lines = new List<QuoteItem>();
    foreach (var item in input.Items)
    {
        var product = store.Products.FirstOrDefault(p => p.Id == item.ProductId);
        if (product is null) return Results.BadRequest($"Producto {item.ProductId} no encontrado.");
        if (item.Quantity <= 0) return Results.BadRequest("La cantidad debe ser mayor a cero.");
        lines.Add(new QuoteItem(product.Id, product.Sku, product.Name, item.Quantity, product.UnitPrice));
    }

    var quote = new Quote(
        store.NextQuoteId(),
        $"COT-{DateTime.UtcNow:yyyy}-{store.Quotes.Count + 1:0000}",
        client.Id,
        client.Name,
        QuoteStatus.Draft,
        DateTime.UtcNow,
        input.ValidUntil,
        lines,
        [new HistoryEvent(DateTime.UtcNow, "Creada", "Cotizacion generada en estado borrador.")]);

    store.Quotes.Add(quote);
    return Results.Created($"/api/quotes/{quote.Id}", quote);
});

app.MapPost("/api/quotes/{id:int}/status", (int id, StatusInput input) =>
{
    var quote = store.Quotes.FirstOrDefault(q => q.Id == id);
    if (quote is null) return Results.NotFound();

    quote.Status = input.Status;
    quote.History.Add(new HistoryEvent(DateTime.UtcNow, $"Estado: {input.Status}", input.Note.Trim()));
    return Results.Ok(quote);
});

app.MapGet("/api/quotes/{id:int}/pdf", (int id) =>
{
    var quote = store.Quotes.FirstOrDefault(q => q.Id == id);
    if (quote is null) return Results.NotFound();

    var bytes = PdfWriter.BuildQuotePdf(quote);
    return Results.File(bytes, "application/pdf", $"{quote.Number}.pdf");
});

app.MapFallbackToFile("index.html");

app.Run();

enum QuoteStatus { Draft, Sent, Approved, Rejected, Expired }

record Supplier(int Id, string Name, string Email, string Phone);
record Client(int Id, string Name, string Email, string Phone);
record Product(int Id, string Sku, string Name, int SupplierId, string SupplierName, decimal UnitPrice);
record QuoteItem(int ProductId, string Sku, string ProductName, int Quantity, decimal UnitPrice)
{
    public decimal Total => Quantity * UnitPrice;
}

record HistoryEvent(DateTime At, string Title, string Detail);

class Quote(
    int id,
    string number,
    int clientId,
    string clientName,
    QuoteStatus status,
    DateTime createdAt,
    DateTime validUntil,
    List<QuoteItem> items,
    List<HistoryEvent> history)
{
    public int Id { get; } = id;
    public string Number { get; } = number;
    public int ClientId { get; } = clientId;
    public string ClientName { get; } = clientName;
    public QuoteStatus Status { get; set; } = status;
    public DateTime CreatedAt { get; } = createdAt;
    public DateTime ValidUntil { get; } = validUntil;
    public List<QuoteItem> Items { get; } = items;
    public List<HistoryEvent> History { get; } = history;
    public decimal Subtotal => Items.Sum(i => i.Total);
    public decimal Tax => Subtotal * 0.19m;
    public decimal Total => Subtotal + Tax;
}

record ProductInput(string Sku, string Name, int SupplierId, decimal UnitPrice);
record PartyInput(string Name, string Email, string Phone);
record QuoteLineInput(int ProductId, int Quantity);
record QuoteInput(int ClientId, DateTime ValidUntil, List<QuoteLineInput> Items);
record StatusInput(QuoteStatus Status, string Note);

class DemoStore
{
    private int _productId = 4;
    private int _supplierId = 3;
    private int _clientId = 3;
    private int _quoteId = 2;

    public List<Product> Products { get; } = [];
    public List<Supplier> Suppliers { get; } = [];
    public List<Client> Clients { get; } = [];
    public List<Quote> Quotes { get; } = [];

    public int NextProductId() => _productId++;
    public int NextSupplierId() => _supplierId++;
    public int NextClientId() => _clientId++;
    public int NextQuoteId() => _quoteId++;

    public static DemoStore Create()
    {
        var store = new DemoStore();
        store.Suppliers.AddRange([
            new Supplier(1, "TecnoMayorista", "ventas@tecnomayorista.cl", "+56 2 2345 8901"),
            new Supplier(2, "OfiSupply", "contacto@ofisupply.cl", "+56 2 2788 1100")
        ]);
        store.Clients.AddRange([
            new Client(1, "Constructora Andes", "compras@andes.cl", "+56 9 5555 2233"),
            new Client(2, "Clinica del Sur", "abastecimiento@clinicasur.cl", "+56 9 4422 1188")
        ]);
        store.Products.AddRange([
            new Product(1, "NB-14P", "Notebook 14 Pro", 1, "TecnoMayorista", 849990),
            new Product(2, "MON-27Q", "Monitor 27 QHD", 1, "TecnoMayorista", 239990),
            new Product(3, "SIL-ERG", "Silla ergonomica", 2, "OfiSupply", 159990)
        ]);
        store.Quotes.Add(new Quote(
            1,
            "COT-2026-0001",
            1,
            "Constructora Andes",
            QuoteStatus.Sent,
            DateTime.UtcNow.AddDays(-2),
            DateTime.UtcNow.AddDays(12),
            [new QuoteItem(1, "NB-14P", "Notebook 14 Pro", 3, 849990), new QuoteItem(2, "MON-27Q", "Monitor 27 QHD", 3, 239990)],
            [
                new HistoryEvent(DateTime.UtcNow.AddDays(-2), "Creada", "Cotizacion inicial generada."),
                new HistoryEvent(DateTime.UtcNow.AddDays(-1), "Estado: Sent", "Enviada al correo de compras.")
            ]));
        return store;
    }
}

static class PdfWriter
{
    public static byte[] BuildQuotePdf(Quote quote)
    {
        var text = new List<string>
        {
            "Gestor de Cotizaciones",
            quote.Number,
            $"Cliente: {quote.ClientName}",
            $"Estado: {quote.Status}",
            $"Valida hasta: {quote.ValidUntil:yyyy-MM-dd}",
            "",
            "Productos"
        };

        text.AddRange(quote.Items.Select(item => $"{item.Sku} - {item.ProductName} x{item.Quantity} @ {item.UnitPrice:C0} = {item.Total:C0}"));
        text.Add("");
        text.Add($"Subtotal: {quote.Subtotal:C0}");
        text.Add($"IVA 19%: {quote.Tax:C0}");
        text.Add($"Total: {quote.Total:C0}");

        var stream = new MemoryStream();
        var offsets = new List<long>();
        void Write(string value) => stream.Write(Encoding.ASCII.GetBytes(value.Replace("á", "a").Replace("é", "e").Replace("í", "i").Replace("ó", "o").Replace("ú", "u").Replace("ñ", "n")));

        Write("%PDF-1.4\n");
        WriteObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
        WriteObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
        WriteObject("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
        WriteObject("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

        var content = new StringBuilder("BT /F1 12 Tf 50 742 Td 16 TL\n");
        foreach (var line in text)
        {
            content.Append('(').Append(Escape(line)).Append(") Tj T*\n");
        }
        content.Append("ET");
        var contentBytes = Encoding.ASCII.GetBytes(content.ToString());
        WriteObject($"5 0 obj\n<< /Length {contentBytes.Length} >>\nstream\n{content}\nendstream\nendobj\n");

        var xref = stream.Position;
        Write($"xref\n0 {offsets.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets) Write($"{offset:0000000000} 00000 n \n");
        Write($"trailer\n<< /Size {offsets.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
        return stream.ToArray();

        void WriteObject(string value)
        {
            offsets.Add(stream.Position);
            Write(value);
        }

        static string Escape(string value) => value.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
    }
}
