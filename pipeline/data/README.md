# Word list

`word_list.tsv` has four tab-separated columns: `rank`, `word`, `article`, `sentence`.

- **Ranking:** based on [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2018 German, CC BY-SA 4.0). The counts were grouped by dictionary form, and names, English words and swearing were removed by hand.
- **Topic words:** the course's vocab topics (days, months, food, clothes, rooms, jobs, countries and so on) were added after rank ~2,280 so every topic has audio.
- **Articles:** nouns carry der/die/das. Plural-only nouns use die. Neuter country names have no article, because they are said without one.
- **Sentences:** short, simple German, with no English, for roughly the top 1,500 words.

To change a word or sentence, edit the file and re-run `audio_bank.py`. Only new or changed clips are generated, because file names come from the text.
