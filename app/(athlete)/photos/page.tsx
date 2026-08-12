import { createClient } from "@/lib/supabase/server";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { AthleteHeroLogo } from "@/components/AthleteHeroLogo";

export default async function AthletePhotosPage() {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("hub_photos")
    .select("id, image_url, caption")
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <AthleteHeroLogo />
      <h1 className="text-2xl font-semibold text-paper">From the Floor</h1>
      {photos && photos.length > 0 ? (
        <PhotoCarousel photos={photos} />
      ) : (
        <p className="text-paper/60 text-sm text-center py-10">No photos posted yet.</p>
      )}
    </div>
  );
}
