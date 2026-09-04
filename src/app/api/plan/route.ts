import { NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { errorJson } from "@/lib/storage";
import { loadProject, saveProject } from "@/lib/project";
import { planFromBlog } from "@/lib/openai";
import { newCardId, type Card } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireUser();
    const { projectId } = await req.json();
    const project = await loadProject(supabase, user.id, String(projectId));

    const plan = await planFromBlog({
      persona: project.persona,
      blogText: project.blog_text,
      count: project.card_count,
      artStyle: project.art_style,
      useCharacter: project.use_character,
      characterDescription: project.character_description,
    });

    const cards: Card[] = plan.cards.map((c) => ({
      id: newCardId(),
      title: c.title ?? "",
      body: c.body ?? "",
      imagePrompt: c.imagePrompt ?? "",
      imageUrl: null,
      design: {},
    }));

    const updated = await saveProject(supabase, project.id, user.id, {
      title: plan.title || project.title,
      design: { ...project.design, accentColor: plan.accentColor },
      cards,
      status: "planned",
    });

    return Response.json({ project: updated });
  } catch (e) {
    return errorJson(e);
  }
}
