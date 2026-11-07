function parseRecordDate(value) {
  if (!value) return null;
  const input = String(value);
  const localizedDate = input.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  if (localizedDate) {
    const [, firstText, secondText, yearText] = localizedDate;
    const first = Number(firstText);
    const second = Number(secondText);
    const monthFirst = second > 12 || (first <= 12 && second <= 12 && /\b(?:AM|PM)\b/i.test(input));
    const month = monthFirst ? first : second;
    const day = monthFirst ? second : first;
    const date = new Date(Number(yearText), month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getReservationTotal(reservation) {
  if (!Array.isArray(reservation.items)) return 0;
  return reservation.items.reduce((total, item) => {
    const price = Number(item.price);
    const quantity = Number(item.qty);
    return total + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
  }, 0);
}

function getSaleDate(record, isInvoice) {
  return parseRecordDate(isInvoice ? record.fecha : record.date);
}

export function getSalesReport(reservas = [], facturas = [], from, to) {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  const days = new Map();
  let totalRevenue = 0;
  let saleCount = 0;

  const addSale = (record, isInvoice) => {
    const date = getSaleDate(record, isInvoice);
    if (!date || (start && date < start) || (end && date > end)) return;
    const revenue = isInvoice ? Number(record.total) : getReservationTotal(record);
    if (!Number.isFinite(revenue) || revenue < 0) return;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const day = days.get(key) || { date: key, revenue: 0, count: 0 };
    day.revenue += revenue;
    day.count += 1;
    days.set(key, day);
    totalRevenue += revenue;
    saleCount += 1;
  };

  reservas.forEach(reserva => addSale(reserva, false));
  facturas.forEach(factura => addSale(factura, true));

  return {
    days: [...days.values()].sort((left, right) => left.date.localeCompare(right.date)),
    totalRevenue,
    saleCount
  };
}

export function getCustomerSummary(reservas = [], facturas = []) {
  const customers = new Map();
  const addRecord = (record, isInvoice) => {
    const name = String((isInvoice ? (record.cliente || record.clientName) : (record.clientName || record.clientname)) || '').trim();
    if (!name) return;

    const key = name.toLocaleLowerCase();
    const customer = customers.get(key) || {
      key,
      name,
      orderCount: 0,
      invoiceCount: 0,
      total: 0,
      lastPurchase: null,
      purchases: []
    };
    const amount = isInvoice ? Number(record.total) : getReservationTotal(record);
    if (Number.isFinite(amount) && amount >= 0) customer.total += amount;
    if (isInvoice) customer.invoiceCount += 1;
    else customer.orderCount += 1;

    const date = getSaleDate(record, isInvoice);
    customer.purchases.push({
      id: `${isInvoice ? 'invoice' : 'order'}-${record.id || customer.purchases.length}`,
      type: isInvoice ? 'Factura' : 'Pedido',
      date: date?.toISOString() || null,
      description: isInvoice
        ? `Mesa ${record.mesa || '—'} · ${record.metodo_pago || 'Método de pago no indicado'}`
        : (Array.isArray(record.items) ? record.items.map(item => `${item.name || 'Producto'} × ${item.qty || 0}`).join(', ') : 'Detalle no disponible'),
      total: Number.isFinite(amount) && amount >= 0 ? amount : 0
    });
    if (date && (!customer.lastPurchase || date > customer.lastPurchase)) {
      customer.lastPurchase = date;
    }
    customers.set(key, customer);
  };

  reservas.forEach(reserva => addRecord(reserva, false));
  facturas.forEach(factura => addRecord(factura, true));

  return [...customers.values()]
    .map(customer => ({
      ...customer,
      lastPurchase: customer.lastPurchase?.toISOString() || null,
      purchases: customer.purchases.sort((left, right) => (right.date || '').localeCompare(left.date || ''))
    }))
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, 'es'));
}

export function getSalesSummary(reservas = [], facturas = [], days = 7, now = new Date()) {
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - index - 1));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      label: new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric' }).format(date),
      revenue: 0,
      count: 0
    };
  });
  const pointsByKey = new Map(series.map(point => [point.key, point]));
  let totalRevenue = 0;
  const addSale = (dateValue, amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return;
    totalRevenue += value;
    const date = parseRecordDate(dateValue);
    if (!date) return;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const point = pointsByKey.get(key);
    if (point) {
      point.revenue += value;
      point.count += 1;
    }
  };

  reservas.forEach(reserva => addSale(reserva.date, getReservationTotal(reserva)));
  facturas.forEach(factura => addSale(factura.fecha, factura.total));

  const periodRevenue = series.reduce((total, point) => total + point.revenue, 0);
  const saleCount = series.reduce((total, point) => total + point.count, 0);
  return { series, totalRevenue, periodRevenue, saleCount };
}

export function getCategoryStock(licores = []) {
  const categories = new Map();
  licores.forEach(licor => {
    const category = licor.category || 'Sin categoría';
    const stock = Number(licor.stock);
    categories.set(category, (categories.get(category) || 0) + (Number.isFinite(stock) ? stock : 0));
  });
  return [...categories.entries()]
    .map(([name, stock]) => ({ name, stock }))
    .sort((left, right) => right.stock - left.stock);
}

export function getTopProducts(reservas = []) {
  const products = new Map();
  reservas.forEach(reserva => {
    if (!Array.isArray(reserva.items)) return;
    reserva.items.forEach(item => {
      const quantity = Number(item.qty);
      if (!item.name || !Number.isFinite(quantity)) return;
      const price = Number(item.price);
      const product = products.get(item.name) || { quantity: 0, revenue: 0 };
      product.quantity += quantity;
      if (Number.isFinite(price) && price >= 0) product.revenue += price * quantity;
      products.set(item.name, product);
    });
  });
  return [...products.entries()]
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((left, right) => right.quantity - left.quantity);
}
