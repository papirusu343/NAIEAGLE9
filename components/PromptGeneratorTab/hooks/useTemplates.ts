import { useState, useEffect } from 'react';
import { TemplateData } from '../types';

export const useTemplates = () => {
  const [templates, setTemplates] = useState<TemplateData[]>([]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/prompt-templates');
      const data = await response.json();
      setTemplates(data.files || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  return {
    templates,
    loadTemplates
  };
};