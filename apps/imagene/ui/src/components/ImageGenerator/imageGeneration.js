import { createImagesBatch } from '../../api/api';
import total_dict from './total_dict.json';

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
    for (let i = 0; i < generationConfig.ngen; i++) {
      image_list.push(images[Math.floor(Math.random() * images.length)].id);
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
      let dir_keywords = []

      for (let i = 0; i < generationConfig.mutation; i++) {
        const random_key = Object.keys(total_dict)[Math.floor(Math.random() * Object.keys(total_dict).length)];
        const random_value = total_dict[random_key][Math.floor(Math.random() * total_dict[random_key].length)];
        if (!dir_keywords.includes(random_value)) {
          dir_keywords.push(random_value);
        }        
        if (dir_keywords.length >= generationConfig.positive_prompt_length_limit - user_keywords.length) {
          break;
        }
      }

      let imageKeywordsList = [];
      Object.entries(imageKeywords).forEach(([key, value]) => {
        if (Math.random() < value && !dir_keywords.includes(key)) {
          imageKeywordsList.push(key);
        }
      });
      imageKeywordsList.sort(() => 0.5 - Math.random());
      for (let i = 0; i < imageKeywordsList.length; i++) {
        dir_keywords.push(imageKeywordsList[i]);
        if (dir_keywords.length >= generationConfig.positive_prompt_length_limit - user_keywords.length) {
          break;
        }  
      }

      //중복 제거 및 shuffle
      dir_keywords = [...new Set(dir_keywords)].sort(() => 0.5 - Math.random()).slice(0, generationConfig.positive_prompt_length_limit - user_keywords.length);

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
