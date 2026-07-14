"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Lesson } from "@/lib/firestore/lessons";

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
  listItem: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#374151",
    marginBottom: 3,
    paddingLeft: 8,
  },
  stepBox: {
    marginBottom: 12,
    paddingLeft: 10,
    borderLeft: "2 solid #d1d5db",
  },
  stepTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#4b5563",
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

interface LessonPDFDocumentProps {
  lesson: Lesson;
  authorName: string;
}

export default function LessonPDFDocument({ lesson, authorName }: LessonPDFDocumentProps) {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document title={lesson.title} author={lesson.authorName}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{lesson.title}</Text>
          <View style={styles.metaRow}>
            {lesson.gradeLevel && (
              <Text style={styles.metaItem}>
                <Text style={styles.metaLabel}>Grade: </Text>
                {lesson.gradeLevel}
              </Text>
            )}
            {lesson.subject && (
              <Text style={styles.metaItem}>
                <Text style={styles.metaLabel}>Subject: </Text>
                {lesson.subject}
              </Text>
            )}
            {lesson.duration && (
              <Text style={styles.metaItem}>
                <Text style={styles.metaLabel}>Duration: </Text>
                {lesson.duration}
              </Text>
            )}
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Author: </Text>
              {lesson.authorName}
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Downloaded: </Text>
              {date}
            </Text>
          </View>
        </View>

        {/* Objectives */}
        {lesson.objectives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Learning Objectives</Text>
            {lesson.objectives.map((obj, i) => (
              <Text key={i} style={styles.listItem}>
                {i + 1}. {obj}
              </Text>
            ))}
          </View>
        )}

        {/* Materials */}
        {lesson.materials.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materials Needed</Text>
            {lesson.materials.map((mat, i) => (
              <Text key={i} style={styles.listItem}>
                • {mat}
              </Text>
            ))}
          </View>
        )}

        {/* Steps */}
        {lesson.steps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lesson Plan</Text>
            {lesson.steps.map((step, i) => (
              <View key={i} style={styles.stepBox}>
                <Text style={styles.stepTitle}>
                  Step {i + 1}: {step.title}
                </Text>
                {step.description ? (
                  <Text style={styles.stepDesc}>{step.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Attachments */}
        {lesson.attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attachments</Text>
            {lesson.attachments.map((att, i) => (
              <Text key={i} style={styles.listItem}>
                • {att.name}: {att.url}
              </Text>
            ))}
          </View>
        )}

        <View fixed style={styles.footer}>
          <Text style={{ fontSize: 8, color: "#9ca3af", textAlign: "center" }}>
            © {new Date().getFullYear()} {authorName} — All rights reserved. Created on EduConnect.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
