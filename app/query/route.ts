import postgres from 'postgres';
const POSTGRES_URL= process.env.POSTGRES_URL!

const sql = postgres(POSTGRES_URL);

async function listInvoices() {
  const data = await sql`
     SELECT invoices.amount, customers.name
     FROM invoices
     JOIN customers ON invoices.customer_id = customers.id
     WHERE invoices.amount = 666;
   `;

  return data;
}

export async function GET() {
  try {
    return Response.json(await listInvoices());
  } catch (error) {
    console.error({ error,e:"err", POSTGRES_URL },);
    
    return Response.json({ error,e:"err", POSTGRES_URL}, { status: 500 });
  }
}
