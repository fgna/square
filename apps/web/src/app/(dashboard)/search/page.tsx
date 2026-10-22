'use client';

import { Suspense } from 'react';
import { SearchPage } from '@/components/search/search-page';

export default function Search() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
