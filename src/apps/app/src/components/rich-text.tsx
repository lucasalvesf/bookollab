import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';

import { fileUrl } from '@/lib/files';
import { splitMentions } from '@/lib/links';
import { makeStyles, radius } from '@/theme';

import { useOpenTarget } from './community-drawer';

/** Image line inside a post: ![caption](uploadKey). */
const IMAGE_LINE = /^!\[(.*?)\]\(([^)\s]+)\)$/;

export function imageMarkup(key: string, caption = '') {
  return `![${caption}](${key})`;
}

type Block = { kind: 'text'; text: string } | { kind: 'image'; key: string; caption: string };

function parse(content: string): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) blocks.push({ kind: 'text', text });
    buffer = [];
  };
  for (const line of content.split('\n')) {
    const image = IMAGE_LINE.exec(line.trim());
    if (image) {
      flush();
      blocks.push({ kind: 'image', key: image[2], caption: image[1] });
    } else if (!line.trim()) {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks;
}

/** Post body (blog format): paragraphs and images placed in the middle of the text. */
export function RichText({ content, textStyle, slug }: { content: string; textStyle?: StyleProp<TextStyle>; slug?: string }) {
  const styles = useStyles();
  const openTarget = useOpenTarget(slug);
  return (
    <View style={styles.body}>
      {parse(content).map((b, i) =>
        b.kind === 'text' ? (
          <Text key={i} style={textStyle}>
            {splitMentions(b.text).map((part, j) =>
              'target' in part ? (
                <Text key={j} accessibilityRole="link" onPress={() => openTarget(part.target)} style={styles.mention}>
                  {part.label}
                </Text>
              ) : (
                part.text
              ),
            )}
          </Text>
        ) : (
          <PostImage key={i} uploadKey={b.key} caption={b.caption} />
        ),
      )}
    </View>
  );
}

function PostImage({ uploadKey, caption }: { uploadKey: string; caption: string }) {
  const styles = useStyles();
  const [ratio, setRatio] = useState(16 / 9);
  const url = fileUrl(uploadKey);
  if (!url) return null;
  return (
    <View style={styles.figure}>
      <Image
        source={{ uri: url }}
        style={[styles.image, { aspectRatio: ratio }]}
        contentFit="cover"
        transition={200}
        accessibilityLabel={caption || 'Imagem do post'}
        onLoad={(e) => e.source.width && e.source.height && setRatio(Math.max(0.5, Math.min(2.5, e.source.width / e.source.height)))}
      />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  body: { gap: 18 },
  figure: { gap: 6 },
  image: { width: '100%', borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  mention: { color: colors.brand, fontWeight: '700', backgroundColor: colors.brandSoft, borderRadius: 4 },
  caption: { fontSize: 13, color: colors.textSubtle, textAlign: 'center', fontStyle: 'italic' },
}));
