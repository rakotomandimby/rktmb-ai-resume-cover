import fs from 'fs';

// Renamed from getSystemInstruction to be specific to Cover Letters
// Added searchCompanyInfo parameter
export function getSystemInstructionCoverLetter(company: string, job: string, words: string, language: string, searchCompanyInfo: boolean): string {
  const cv_en = fs.readFileSync('./src/cv-en.md', 'utf8');
  const cv_fr = fs.readFileSync('./src/cv-fr.md', 'utf8');
  let company_search_fr = '';
  let company_search_en = '';

  // Only include company search instruction if company is not "Unknown" AND searchCompanyInfo is true
  if(company !== 'Unknown' && searchCompanyInfo){
    company_search_fr = 'Prends ce que tu sais sur la société "' + company + '". '; // Added space at the end
  }

  if(company !== 'Unknown' && searchCompanyInfo){
    company_search_en = 'Grab what you have about the company "' + company + '". '; // Added space at the end
  }

  let system_instruction_fr = ():string => {
    return '# Instructions pour Lettre de Motivation\n\n'
      + 'Agis en tant que chercheur d\'emploi qui veut rédiger une lettre de motivation qui sera utile pour obtenir un emploi. '
      + company_search_fr // This will be empty if conditions are not met
      + 'et écris une lettre de motivation de ' + words + ' mots avec des mots qui sont significatifs pour un responsable des ressources humaines.\n\n'
      + 'Voici la description du poste convoité:\n\n"' + job + '".\n'
      + 'Le CV de base du candidat est le suivant:\n\n"' + cv_fr + '".\n'
      + 'Parles à la première personne, tu es le candidat. Pour formatter ta réponse, n\'utilises pas Markdown, utilises simplement du texte brut.';
  }
  let system_instruction_en = ():string => {
    return '# Cover Letter Instructions\n\n'
      + 'Act as a job seeker who needs to write a cover letter that will be valuable to get a job. '
      + company_search_en // This will be empty if conditions are not met
      + 'and write a '+ words +' words cover letter with words that are meaningful to human resource staff.\n\n'
      + 'This is the job description:\n\n"'+ job + '".\n'
      + 'The candidate\'s base CV is as follows:\n\n"' + cv_en + '".\n'
      + 'You will talk in the first person, as you are the candidate. For formatting your answer, do not use Markdown, just plain text.';
  }

  if (language === 'French') {
    return system_instruction_fr();
  }
  if (language === 'English') {
    return system_instruction_en();
  }
  return '';
}

// New function for CV System Instructions
export function getSystemInstructionCV(jobDescription: string, language: string): string {
  const cv_en_base = fs.readFileSync('./src/cv-en.md', 'utf8');
  const cv_fr_base = fs.readFileSync('./src/cv-fr.md', 'utf8');

  let system_instruction_fr = ():string => {
    return '# Instructions pour Génération de CV\n\n'
      + ' Tu es un expert en rédaction de CV. Ta tâche est de créer un CV sur mesure basé sur le CV de base fourni et la description de poste spécifique. \n'
      + ' Le CV doit mettre en évidence les compétences et expériences pertinentes du CV de base qui correspondent aux exigences du poste. \n'
      + ' Réorganise et reformule les sections du CV de base pour les aligner étroitement avec la description de poste. \n'
      + ' Assure-toi que le résultat est un CV complet, professionnel et optimisé pour le poste.\n\n'
      + ' Voici la description du poste pour lequel adapter le CV:\n\n"' + jobDescription + '".\n\n'
      + ' Voici le CV de base du candidat:\n\n"' + cv_fr_base + '".\n\n'
      + ' Le CV généré doit être formaté dans un fragment HTML sans la balise HTML, ni la balise HEAD, ni la balise  TITLE, ni la balise BODY, ni la balise BR .'
      + ' Il ne faut mettre aucun élément Markdown dans la réponse: ne pas mettre de triple apostrophe inversées.'
  }

  let system_instruction_en = ():string => {
    return '# CV Generation Instructions\n\n'
      + ' You are an expert CV writer. Your task is to create a tailored CV based on the provided base CV and the specific job description.\n'
      + ' The CV should highlight relevant skills and experiences from the base CV that match the job requirements.\n'
      + ' Reorganize and rephrase sections of the base CV to align closely with the job description.\n'
      + ' Ensure the output is a complete, professional CV optimized for the position.\n\n'
      + ' This is the job description to tailor the CV for:\n\n"' + jobDescription + '".\n\n'
      + ' This is the candidate\'s base CV:\n\n"' + cv_en_base + '".\n\n'
      + ' The generated CV should be formatted in an HTML fragment without the HTML tag , nor the HEAD tag , nor the TITLE tag , nor the BODY tag, nor the BR tag.'
      + ' Do not put any Markdown elements in the answer: do not put triple backticks.'
  }

  if (language === 'French') {
    return system_instruction_fr();
  }
  if (language === 'English') {
    return system_instruction_en();
  }
  return '';
}
