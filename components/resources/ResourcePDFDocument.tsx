"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register a system-safe sans-serif font stack
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 24,
    borderBottom: "2 solid #7c1d1d",
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#7c1d1d",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 4,
  },
  metaItem: {
    fontSize: 9,
    color: "#6b7280",
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 6,
    borderBottom: "1 solid #e5e7eb",
    paddingBottom: 3,
  },
  body: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#374151",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tag: {
    fontSize: 9,
    backgroundColor: "#f3f4f6",
    color: "#374151",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

export interface ResourcePDFProps {
  title: string;
  description: string;
  gradeLevel: string;
  subject: string;
  type: string;
  tags: string[];
  authorName: string;
}

export default function ResourcePDFDocument({
  title,
  description,
  gradeLevel,
  subject,
  type,
  tags,
  authorName,
}: ResourcePDFProps) {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document title={title} author={authorName}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Grade: </Text>
              {gradeLevel}
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Subject: </Text>
              {subject}
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Type: </Text>
              {type}
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Author: </Text>
              {authorName}
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date: </Text>
              {date}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.body}>{description}</Text>
        </View>

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagRow}>
              {tags.map((tag) => (
                <Text key={tag} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Shared on EduConnect · {date}
        </Text>
      </Page>
    </Document>
  );
}
