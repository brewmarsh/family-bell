const languages = {
  en: {
    header: "Family Bell",
    scheduled_bells: "Scheduled Bells",
    no_bells: "No bells scheduled yet.",
    add_new_bell: "Add New Bell",
    vacation_mode: "Vacation Mode",
    start_date: "Start Date",
    end_date: "End Date",
    days_to_repeat: "Days to Repeat:",
    select_speakers: "Select Speakers:",
    save_bell: "Save Bell",
    what_to_say: "What should I say?",
    delete_confirm: "Delete this bell?",
    missing_fields: "Please fill in time, message, select at least one day and one speaker.",
    speakers: "Speaker(s)",
    days: {
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",
    },
    days_short: {
      mon: "M",
      tue: "T",
      wed: "W",
      thu: "T",
      fri: "F",
      sat: "S",
      sun: "S",
    },
  },
  es: {
    header: "Timbre Familiar",
    scheduled_bells: "Timbres Programados",
    no_bells: "No hay timbres programados aún.",
    add_new_bell: "Agregar Nuevo Timbre",
    vacation_mode: "Modo Vacaciones",
    start_date: "Fecha de Inicio",
    end_date: "Fecha de Fin",
    days_to_repeat: "Días para Repetir:",
    select_speakers: "Seleccionar Altavoces:",
    save_bell: "Guardar Timbre",
    what_to_say: "¿Qué debo decir?",
    delete_confirm: "¿Eliminar este timbre?",
    missing_fields: "Por favor complete la hora, el mensaje, seleccione al menos un día y un altavoz.",
    speakers: "Altavoz(ces)",
    days: {
      mon: "Lun",
      tue: "Mar",
      wed: "Mié",
      thu: "Jue",
      fri: "Vie",
      sat: "Sáb",
      sun: "Dom",
    },
    days_short: {
      mon: "L",
      tue: "M",
      wed: "M",
      thu: "J",
      fri: "V",
      sat: "S",
      sun: "D",
    },
  },
  fr: {
    header: "Cloche Familiale",
    scheduled_bells: "Cloches Programmées",
    no_bells: "Aucune cloche programmée pour le moment.",
    add_new_bell: "Ajouter une Nouvelle Cloche",
    vacation_mode: "Mode Vacances",
    start_date: "Date de Début",
    end_date: "Date de Fin",
    days_to_repeat: "Jours à Répéter :",
    select_speakers: "Sélectionner les Haut-parleurs :",
    save_bell: "Enregistrer la Cloche",
    what_to_say: "Que dois-je dire ?",
    delete_confirm: "Supprimer cette cloche ?",
    missing_fields: "Veuillez remplir l'heure, le message, sélectionner au moins un jour et un haut-parleur.",
    speakers: "Haut-parleur(s)",
    days: {
      mon: "Lun",
      tue: "Mar",
      wed: "Mer",
      thu: "Jeu",
      fri: "Ven",
      sat: "Sam",
      sun: "Dim",
    },
    days_short: {
      mon: "L",
      tue: "M",
      wed: "M",
      thu: "J",
      fri: "V",
      sat: "S",
      sun: "D",
    },
  },
};

export function localize(key, hass) {
  let lang = "en";
  if (hass) {
    if (hass.locale && hass.locale.language) {
      lang = hass.locale.language;
    } else if (hass.language) {
      lang = hass.language;
    }
  }

  // Strip region code if present (e.g., 'es-ES' -> 'es')
  if (lang.includes('-')) {
    lang = lang.split('-')[0];
  }

  const translated = languages[lang] || languages["en"];

  // Handle nested keys (e.g. days.mon)
  if (key.includes('.')) {
      const parts = key.split('.');
      let result = translated;
      for (const part of parts) {
          result = result && result[part];
      }
      return result || languages["en"][parts[0]][parts[1]]; // Fallback to EN if specific nested key missing
  }

  return translated[key] || languages["en"][key];
}
