import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CodeArtifact {
  id: string;
  project_id: string;
  message_id?: string;
  title?: string;
  description?: string;
  code: string;
  language: 'react' | 'javascript' | 'python' | 'html' | 'css' | 'scratch';
  version_number: number;
  parent_artifact_id?: string;
  execution_successful: boolean;
  execution_output?: string;
  error_message?: string;
  execution_timestamp?: string;
  is_milestone: boolean;
  milestone_description?: string;
  file_structure: Record<string, any>;
  dependencies: string[];
  created_at: string;
  updated_at: string;
  complexity_score?: number;
  educational_notes?: string;
  lines_of_code?: number;
  functions_count: number;
  variables_count: number;
  is_featured: boolean;
  times_viewed: number;
  times_modified: number;
  last_viewed_at?: string;
  concepts_demonstrated: string[];
  memory_used_mb?: number;
  execution_status: 'pending' | 'success' | 'error' | 'timeout' | 'manual_stop';
}

export function useCodeArtifacts(projectId: string) {
  const [artifacts, setArtifacts] = useState<CodeArtifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<CodeArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all artifacts for a project
  const fetchArtifacts = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('code_artifacts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      setArtifacts(data || []);
      
      // Set the most recent artifact as current if none is selected
      if (!currentArtifact && data && data.length > 0) {
        setCurrentArtifact(data[0]);
      }
    } catch (err) {
      console.error('Error fetching code artifacts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch code artifacts');
    } finally {
      setLoading(false);
    }
  }, [projectId, currentArtifact]);

  // Create a new code artifact
  const createArtifact = useCallback(async (
    code: string,
    language: CodeArtifact['language'],
    options: {
      title?: string;
      description?: string;
      message_id?: string;
      is_milestone?: boolean;
      milestone_description?: string;
      educational_notes?: string;
    } = {}
  ) => {
    if (!projectId) return null;

    try {
      // Get the next version number
      const nextVersion = artifacts.length + 1;
      
      const newArtifact = {
        project_id: projectId,
        code,
        language,
        version_number: nextVersion,
        execution_successful: false,
        is_milestone: false,
        file_structure: {},
        dependencies: [],
        functions_count: 0,
        variables_count: 0,
        is_featured: false,
        times_viewed: 0,
        times_modified: 0,
        concepts_demonstrated: [],
        execution_status: 'pending' as const,
        ...options
      };

      const { data, error: createError } = await supabase
        .from('code_artifacts')
        .insert([newArtifact])
        .select()
        .single();

      if (createError) throw createError;

      setArtifacts(prev => [data, ...prev]);
      setCurrentArtifact(data);
      
      return data;
    } catch (err) {
      console.error('Error creating code artifact:', err);
      setError(err instanceof Error ? err.message : 'Failed to create code artifact');
      return null;
    }
  }, [projectId, artifacts.length]);

  // Update artifact execution status
  const updateExecutionStatus = useCallback(async (
    artifactId: string,
    execution_successful: boolean,
    execution_output?: string,
    error_message?: string
  ) => {
    try {
      const { data, error: updateError } = await supabase
        .from('code_artifacts')
        .update({
          execution_successful,
          execution_output,
          error_message,
          execution_timestamp: new Date().toISOString(),
          execution_status: execution_successful ? 'success' : 'error'
        })
        .eq('id', artifactId)
        .select()
        .single();

      if (updateError) throw updateError;

      setArtifacts(prev => 
        prev.map(artifact => 
          artifact.id === artifactId ? data : artifact
        )
      );
      
      if (currentArtifact?.id === artifactId) {
        setCurrentArtifact(data);
      }

      return data;
    } catch (err) {
      console.error('Error updating execution status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update execution status');
      return null;
    }
  }, [currentArtifact?.id]);

  // Increment view count when artifact is viewed
  const incrementViewCount = useCallback(async (artifactId: string) => {
    try {
      // First get the current times_viewed value
      const { data: currentData } = await supabase
        .from('code_artifacts')
        .select('times_viewed')
        .eq('id', artifactId)
        .single();

      if (currentData) {
        await supabase
          .from('code_artifacts')
          .update({
            times_viewed: (currentData.times_viewed || 0) + 1,
            last_viewed_at: new Date().toISOString()
          })
          .eq('id', artifactId);
      }
    } catch (err) {
      console.error('Error incrementing view count:', err);
    }
  }, []);

  // Set current artifact and track view
  const selectArtifact = useCallback(async (artifact: CodeArtifact) => {
    setCurrentArtifact(artifact);
    await incrementViewCount(artifact.id);
  }, [incrementViewCount]);

  // Load artifacts when project changes
  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  return {
    artifacts,
    currentArtifact,
    loading,
    error,
    fetchArtifacts,
    createArtifact,
    updateExecutionStatus,
    selectArtifact,
    setCurrentArtifact
  };
}
