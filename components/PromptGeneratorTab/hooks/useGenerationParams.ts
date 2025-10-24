import { useForm, useFieldArray } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { GenerationParams, STORAGE_KEYS } from '../../../types/novelai';

export const useGenerationParams = () => {
  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<GenerationParams>({
    defaultValues: {
      prompt: '',
      negativePrompt: 'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, extra digits, fewer digits, signature, watermark, username, artist name, text',
      width: 832,
      height: 1216,
      steps: 28,
      scale: 5,
      cfgRescale: 0,
      seed: undefined,
      sampler: 'k_euler_ancestral',
      model: 'nai-diffusion-4-5-full',
      customModel: '',
      characters: [],
      useCoords: false,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'characters',
  });

  const watchModel = watch('model');
  const watchWidth = watch('width');
  const watchHeight = watch('height');
  const [showCustomModel, setShowCustomModel] = useState(false);

  const loadSavedParams = () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LAST_GENERATION_PARAMS);
      if (saved) {
        const savedParams = JSON.parse(saved);
        reset({
          ...savedParams,
          characters: savedParams.characters || []
        });
      }
    } catch (error) {
      console.warn('Failed to load saved params:', error);
    }
  };

  const saveParams = (params: GenerationParams) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_GENERATION_PARAMS, JSON.stringify(params));
    } catch (error) {
      console.warn('Failed to save params:', error);
    }
  };

  useEffect(() => {
    loadSavedParams();
  }, []);

  useEffect(() => {
    setShowCustomModel(watchModel === 'custom');
  }, [watchModel]);

  const addCharacter = () => {
    append({
      caption: '',
      negativeCaption: '',
      x: 0.5,
      y: 0.5,
    }, { shouldFocus: false });
  };

  const removeCharacter = (index: number) => {
    remove(index);
  };

  const handlePresetSize = (width: number, height: number) => {
    setValue('width', width, { shouldFocus: false });
    setValue('height', height, { shouldFocus: false });
  };

  const handleRandomSeed = () => {
    setValue('seed', Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), { shouldFocus: false });
  };

  const handleClearSeed = () => {
    setValue('seed', undefined, { shouldFocus: false });
  };

  return {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    errors,
    fields,
    append,
    remove,
    watchModel,
    watchWidth,
    watchHeight,
    showCustomModel,
    addCharacter,
    removeCharacter,
    handlePresetSize,
    handleRandomSeed,
    handleClearSeed,
    saveParams
  };
};