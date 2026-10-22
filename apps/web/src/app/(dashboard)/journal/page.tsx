import { redirect } from 'next/navigation';

// The journal is a built-in plugin now; old links and bookmarks keep working.
export default function JournalRedirect() {
  redirect('/p/journal');
}
