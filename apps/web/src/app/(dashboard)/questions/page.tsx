import { redirect } from 'next/navigation';

// Questions are a tab of the forum now; old links and bookmarks land there.
export default function Questions() {
  redirect('/feed?type=QUESTION');
}
