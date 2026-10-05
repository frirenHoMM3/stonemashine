// Структурированные данные для поисковиков (schema.org). "<" экранируем, чтобы текст из админки не закрыл тег.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
