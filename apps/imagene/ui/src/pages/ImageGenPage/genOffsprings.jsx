import prompt_keywords from '../../service/prompt_keywords.json';

export const genOffsprings = (pool, mutation, nGen) => {
  const prompt_keywords_list = [];
  Object.entries(prompt_keywords).forEach(([prompt_key_type, prompt_key_values]) => {
    prompt_key_values.forEach((prompt_key_value) => {
      prompt_key_value.split(',').forEach((prompt_key_value_item) => {
        prompt_keywords_list.push({key: prompt_key_type, value: prompt_key_value_item.trim(), direction: 1});
      });
    });
  }); 

  const offsprings = [];
  for (let i = 0; i < nGen; i++) {
    const parent_a = pool[Math.floor(Math.random() * pool.length)];
    const parent_b = pool[Math.floor(Math.random() * pool.length)];
    const other_keywords =[]
    for (let j = 0; j < mutation; j++) {
      other_keywords.push(prompt_keywords_list[Math.floor(Math.random() * prompt_keywords_list.length)]);
    }
    const length = (parent_a.length + parent_b.length)/2+Math.floor((-0.5+Math.random()) * mutation);
    let offspring = [];
    offspring.push(...parent_a);
    offspring.push(...parent_b);
    offspring.push(...other_keywords);
    offspring = [...offspring].sort(() => 0.5 - Math.random()).slice(0, length);
    // offspring 중복 제거
    offspring = [...new Set(offspring)];  
    offsprings.push(offspring);
  }
  return offsprings;
};
