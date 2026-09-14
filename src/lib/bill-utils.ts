export interface BillData {
  invoiceNo: string;
  date: string;
  customerName: string;
  phone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  subtotal: number;
  discount: number;
  freight: number;
  total: number;
  note: string;
  paymentMode: string;
}

export interface SaleDocument {
  _id: string;
  saleNumber: string;
  customerName: string;
  phone: string;
  shopName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  totalAmount: number;
  discount: number;
  freight: number;
  paymentMode: string;
  amountPaid: number;
  balanceDue: number;
  saleDate: Date | string;
  notes: string;
}

export function formatBillDate(date: Date | string): string {
  const dt = new Date(date);
  if (isNaN(dt.getTime())) return '-';
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

export function buildBillData(sale: SaleDocument): BillData {
  const items = (sale.items || []).map((it: any) => ({
    name: it.name,
    quantity: it.quantity,
    price: it.price,
    amount: it.subtotal ?? it.price * it.quantity,
  }));
  const subtotal = items.reduce((sum: number, it: any) => sum + it.amount, 0);
  const discount = sale.discount || 0;
  const freight = sale.freight || 0;
  return {
    invoiceNo: sale.saleNumber || '—',
    date: formatBillDate(sale.saleDate || new Date()),
    customerName: sale.customerName || '',
    phone: sale.phone || '',
    items,
    subtotal,
    discount,
    freight,
    total: sale.totalAmount ?? Math.max(0, subtotal + freight - discount),
    note: sale.notes || '',
    paymentMode: sale.paymentMode,
  };
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(amount: number): string {
  return amount.toLocaleString('en-IN');
}
