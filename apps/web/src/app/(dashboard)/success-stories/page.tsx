import { redirect } from 'next/navigation';

// Success stories are a tab of the forum now; old links and bookmarks land there.
export default function SuccessStories() {
  redirect('/feed?type=SUCCESS_STORY');
}
