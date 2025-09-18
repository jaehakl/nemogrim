import { createImagesBatch } from '../../api/api';

export const generateOffsprings = async (params) => {
  const {
    directory,
    images,
    imageKeywords,
    userPrompt,
    generationConfig,
    refreshDirectory,
    onComplete
  } = params;

  let resolution = generationConfig.resolution_options[Math.floor(Math.random() * generationConfig.resolution_options.length)];
  let image_list = [];
  
  if (generationConfig.useDirectoryImage && images.length > 0) {
    const first_image = images[Math.floor(Math.random() * images.length)];
    for (let i = 0; i < generationConfig.ngen; i++) {
      image_list.push(first_image.id);
    }
  }

  const imageRequest = {
    path: directory.path,
    ckpt_path: generationConfig.modelPath,
    positive_prompt_list: [],
    negative_prompt_list: [],
    seed_list: [],
    images: image_list,
    strength: generationConfig.useImageStrength,
    steps: generationConfig.steps,
    cfg: generationConfig.cfg,
    width: resolution[0],
    height: resolution[1],
    max_chunk_size: generationConfig.maxChunkSize,
  };
  
  for (let i = 0; i < generationConfig.ngen; i++) {
    let positive_prompt = userPrompt;
    if (generationConfig.useDirectoryPrompt) {
      const user_keywords = userPrompt.split(',').map(keyword => keyword.trim());
      const dir_keywords = []
      Object.entries(imageKeywords).forEach(([key, value]) => {
        if (Math.random() < value && !dir_keywords.includes(key)) {
          dir_keywords.push(key);
        }
        if (dir_keywords.length >= generationConfig.positive_prompt_length_limit - user_keywords.length) {
          return;
        }
      });
      if (positive_prompt !== '') {
        positive_prompt += ',';
      }
      positive_prompt += dir_keywords.join(',');
    }
    imageRequest.positive_prompt_list.push(positive_prompt);

    imageRequest.negative_prompt_list.push(generationConfig.negative_prompt);
    imageRequest.seed_list.push(Math.floor(Math.random() * (generationConfig.seedRange[1] - generationConfig.seedRange[0] + 1)) + generationConfig.seedRange[0]);
  }
  
  try {
    const response = await createImagesBatch(imageRequest);
    refreshDirectory();
    
    if (onComplete) {
      onComplete(response);
    }
    
    return response;
  } catch (error) {
    console.error('이미지 생성 중 오류 발생:', error);
    throw error;
  }
};
