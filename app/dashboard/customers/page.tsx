import { Suspense } from 'react';
import { fetchFilteredCustomers } from '@/app/lib/data';
import CustomersTable from '@/app/ui/customers/table';
import  InvoicesSkeleton  from '@/app/ui/skeletons';

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    query?: string;
  };
}) {
  const query =( await searchParams)?.query || '';
  const customers = await fetchFilteredCustomers(query);

  return (
    <main>
      <Suspense fallback={<InvoicesSkeleton />}>
        <CustomersTable customers={customers} />
      </Suspense>
    </main>
  );
}