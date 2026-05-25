import { SpecArtifactEditor } from "@/components/spec-artifact-editor";

export default async function WorkspaceArtifactPage({
  params,
}: {
  params: Promise<{ repoKey: string; artifactType: string; artifactId: string }>;
}) {
  const { repoKey, artifactType, artifactId } = await params;
  return (
    <SpecArtifactEditor
      repoKey={repoKey.toUpperCase()}
      artifactType={artifactType}
      artifactId={artifactId}
    />
  );
}
