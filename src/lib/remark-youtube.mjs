// A paragraph that contains nothing but a YouTube link becomes an embedded player.
// So in a post you just paste the link on its own line:
//
//   https://www.youtube.com/watch?v=iNZrSuBnJno
//
const YT = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/;

function textOf(node) {
  if (node.type === 'text') return node.value;
  if (node.type === 'link') return node.url;
  return '';
}

function walk(node) {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type === 'paragraph' && child.children.length === 1) {
      const only = child.children[0];
      const url = textOf(only).trim();
      const m = url.match(YT);
      if (m) {
        return {
          type: 'html',
          value:
            `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" ` +
            `title="YouTube video" loading="lazy" allowfullscreen ` +
            `allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`,
        };
      }
    }
    walk(child);
    return child;
  });
}

export default function remarkYoutube() {
  return (tree) => walk(tree);
}
