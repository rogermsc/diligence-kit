export class GetOnePagerMarkdownUseCase {
  execute(automationResult: Record<string, unknown>): string | null {
    if (!automationResult) {
      return null;
    }

    const markdown = automationResult.one_pager_markdown as string | undefined;

    if (!markdown || typeof markdown !== "string") {
      return null;
    }

    const hasMarkdownElements =
      /(\#{1,6}\s.+)|(\*\*.+\*\*)|(\*.+\*)|(\[.+\]\(.+\))|(\n\s*[-*+]\s+.+)/g.test(
        markdown
      );

    if (!hasMarkdownElements) {
      console.warn("Content doesn't appear to be valid markdown");
    }

    return markdown;
  }
}
