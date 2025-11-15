import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const FileContents = `1. Start With the Customer
- Review customer feedback, product reviews, and FAQs.
- Pull out the words your customers use most often — these are gold for headlines.

2. Lead With One Clear Benefit
- Don’t list everything at once. Pick the single most compelling benefit (comfort, savings, durability, etc.).
- Write a headline that makes the reader say, “That’s exactly what I need.”

3. Use Simple Visuals
- Product in focus — clean background, high contrast.
- Show the transformation if possible (before/after, problem/solution).
- Keep text on the image short and bold.

4. Mirror Emotions
- Tap into how the customer feels before and after using the product.
- Use emotion-driven words (“finally,” “no more,” “so easy”) to emphasize relief or excitement.

5. Build Social Proof
- Feature a short customer quote, rating, or proof point (e.g., “10,000+ happy customers”).
- This builds instant credibility.

6. Keep It Thumb-Stop Friendly
- Ads must grab attention fast — test bold colors, clear fonts, or surprising imagery.
- Remember: the first second matters most.

7. End With a Clear CTA
- Tell the user exactly what to do next: Shop Now, Try Today, Learn More.
- Place the CTA where it’s obvious and easy to click.`;



export const contextTool = createTool({
  id: "context-tool",
  description: "Get Context from the database",
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async () => {
    return {
      output: FileContents,
    };
  },
});
