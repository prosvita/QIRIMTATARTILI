#!/usr/bin/env python
# Author: Tim N @timntimn

import os

# Create registry files
# for details, see https://www.sketchengine.eu/documentation/corpus-configuration-file-all-features/
reg_template = """MAINTAINER "your@yourdomain.com"
INFO "Qırımtatarca Online Terciman"
NAME "Corpus in %(lang)s"
PATH "%(path)s"
ENCODING "UTF-8"
LANGUAGE "%(language)s"
VERTICAL "%(vertical)s"

FULLREF "%(fullref)s"

ATTRIBUTE   word
# ATTRIBUTE   lemma
# ATTRIBUTE   tag
# ATTRIBUTE   status

ATTRIBUTE lc {
  LABEL    "word (lowercase)"
  DYNAMIC  utf8lowercase
  DYNLIB   internal
  ARG1     "C"
  FUNTYPE  s
  FROMATTR word
  TYPE     index
  TRANSQUERY yes
}

STRUCTURE doc {
%(attributes)s
}

STRUCTURE s

ALIGNSTRUCT "s"
ALIGNDEF "%(aligndef)s"
ALIGNED "%(aligned)s"
"""

def main():
  corpora_name = 'qirimtatarca'
  dest_path = os.getcwd() + '/target/corpus-source/'
  compile_path = os.getcwd() + '/target/corpus-compiled/'
  attributes_file = os.getcwd() + '/target/attributes.txt'
  list_file = os.getcwd() + '/target/list.txt'

  corpora_path = compile_path + corpora_name
  indexed_path = corpora_path + '/indexed'
  vertical_path = corpora_path + '/vertical'
  registry_path = compile_path + 'registry/'
  # vertical_path = '/corpora/%s/vertical' % corpora_name

  # Prepare folders
  init_folder(dest_path)
  init_folder(compile_path)
  init_folder(corpora_path)
  init_folder(registry_path)


  # First, load attributes of files
  fname2attributes, attribute_names = get_all_files(attributes_file)
  print('Text attributes:', attribute_names)

  with open(list_file) as ft:
    lang_list, langs, align_files = init_vert_n_align_files(ft, dest_path)

    for line in ft:
      line = line.rstrip('\r\n')  # it is ok to have empty tabs from the left though! We anyway cut only 'newline's, not tabs!
      if len(line) == 0:
        continue
      dat = line.split('\t')

      translations_of_text = get_translations(langs, lang_list, dat, attribute_names, fname2attributes)

      write_vert(langs, lang_list, translations_of_text)
      finish_vert(langs, lang_list, translations_of_text)
      write_align(langs, lang_list, align_files)

  print('Sentense statistics:')
  for langId in langs:
    print('%20s %5d' % (langId, langs[langId][1]))
    init_folder('%s%s' % (compile_path, langId))

  finish_files(langs)
  finish_files(align_files)
  create_reg_files(langs, align_files, attribute_names, dest_path, compile_path, reg_template)

  os._exit(os.EX_OK)

def init_folder(dir_path):
  if os.path.exists(dir_path):
    for root, dirs, files in os.walk(dir_path, topdown=False):
      for name in files:
          os.remove(os.path.join(root, name))
      for name in dirs:
          os.rmdir(os.path.join(root, name))
  else:
    os.makedirs(dir_path)

def get_all_files(attributes_file):
  fname2attributes = {} # filename -> list of values
  attribute_names = [] # list of attribtute names
  with open(attributes_file) as fa:
    attribute_names = fa.readline().strip().split('\t')[1:] # we cut 1-st column, which contains filenames by definition
    for line in fa:
      line = line.strip()
      if len(line)==0:
        continue
      dat = line.split('\t')
      fname2attributes[dat[0]] = dat[1:]
  return fname2attributes, attribute_names

def init_vert_n_align_files(ft, dest_path):
  langs = {} # language id -> [vertical_file_obj, num_sentences_written, vert_file_name]
  align_files = {} # (lang_from, lang_to) -> [file_obj, align_file_name]
  hdr = ft.readline().strip().split('\t')
  lang_list = hdr
  for i, langId1 in enumerate(hdr):
    vert_file_name = dest_path + langId1 + '.vert'
    langs[langId1] = [open(vert_file_name, 'w'), 0, vert_file_name, []]
    # the fields are: file_id, non-empty line index (after paragraph lines excluded), full_file_name, line indices (including -1, but excluding paragraph lines) to be used for alignments
    #                 0        1                                                      2               3
    for j, langId2 in enumerate(hdr):
      if j==i:
        continue # the language can not be aligned to itself
      key = (langId1, langId2)
      align_filename = dest_path + ('%s_to_%s.align' % key)
      align_files[key] = [open(align_filename, 'w'), align_filename]
  return lang_list, langs, align_files

def get_translations(langs, lang_list, dat, attribute_names, fname2attributes):
  translations_of_text = [] # list of input_fid or None (if fname was empty)
  all_empty = True
  for langId, fnm in zip(lang_list, dat):
    if len(fnm) > 0:
      vert_fid = langs[langId][0]
      # put text attributes
      vert_fid.write('<doc')
      for an, av in zip(attribute_names, fname2attributes[fnm]):
        vert_fid.write(' %s="%s"' % (an, av) )
      vert_fid.write('>\n')
      #
      translations_of_text.append( open(fnm) )
      all_empty = False
    else:
      translations_of_text.append( None )
  #
  assert not all_empty
  return translations_of_text

def write_vert(langs, lang_list, translations_of_text):
  iLine = 0
  while True:
    translations_of_line = []
    finished = False
    par_line = True
    for langId, tfid in zip(lang_list, translations_of_text):
      if tfid is None:
        translations_of_line.append('')
        continue
      #
      sent = tfid.readline()
      if len(sent) == 0:
        finished = True # when EOF occured on at least one of the text files
      else:
        sent = sent.strip()
        if len(sent) > 0:
          par_line = False
          translations_of_line.append(sent)
        else:
          translations_of_line.append('')
        #
      #
    #
    if finished:
      break
    #
    iLine += 1
    if par_line:
      # print(iLine, end='; ')
      continue
    #
    for langId, sent in zip(lang_list, translations_of_line):
      if sent == '':
        langs[langId][3] . append(-1)
      else:
        vert_fid = langs[langId][0]
        vert_fid.write('<s>\n')
        for word in sent.split():
          vert_fid.write('%s\n' % word)
        vert_fid.write('</s>\n')

        ne_np_lineId = langs[langId][1] # 'logical' line number (non-empty within non-paragraph)
        langs[langId][3] . append(ne_np_lineId)
        langs[langId][1] = ne_np_lineId + 1
      #
    #
  #
  # print()

def finish_vert(langs, lang_list, translations_of_text):
  for langId, tfid in zip(lang_list, translations_of_text):
    if tfid is not None:
      vert_fid = langs[langId][0]
      vert_fid.write('</doc>\n')
      tfid.close()

def write_align(langs, lang_list, align_files):
  for langId in lang_list:
    for key, afid in align_files.items():
      if key[0] == langId:
        #
        ne_np_left, ne_np_right = langs[key[0]][3], langs[key[1]][3]
        for n1,n2 in zip(ne_np_left, ne_np_right):
          if not (n1==-1 and n2==-1):
            afid[0].write('%d\t%d\n' % (n1,n2))

  for langId in lang_list:
    # clean line num buffers to save the memory
    langs[langId][3] = []

def finish_files(files):
  for fid in files.values():
    fid[0].close()

def create_reg_files(langs, align_files, attribute_names, dest_path, compile_path, reg_template):
  for langId, vert_info in langs.items():
    numSentsInDestCorpus = langs[langId][1]
    if numSentsInDestCorpus == 0:
      print('[%-20s]'%langId, 'There were no sentenses in %s -- no registry file will be created!' % langId)
      print('[%-20s]'%langId, 'You might also want to remove %s_to_*.align files' % langId)
      continue
    #

    with open(dest_path + ('%s_reg' % langId), 'w') as fr:
      # friendly_name, path, vertical, fullref, doc, aligndef, aligned
      fullref = ','.join(['doc.%s' % a for a in attribute_names])
      attrs = '\n'.join(['  ATTRIBUTE %s' % a.lower() for a in attribute_names])
      aligned_to = []
      for key, afid in align_files.items():
        if key[0] == langId:
          numSentsInDestCorpus = langs[key[1]][1]
          if numSentsInDestCorpus > 0:
            # aligned_to.append( (key[1], afid[1]) ) # (langTo, align_file_name)
            aligned_to.append( ('%s%s' % (dest_path, key[1]), afid[1]) ) # (langTo, align_file_name)
          else:
            print('[%20s]'%key[1], '%s will not be aligned to %s, because the latter has zero size' % key)
            print('[%20s]'%key[1], 'You might also want to remove %s_to_%s.align file' % key)
      #
      language_names = {
        'crh-Cyrl': 'Tatar',
        'crh-RU': 'Tatar',
        'crh': 'Tatar',
        'uk': 'Ukrainian',
        'ru': 'Russian'
      }
      reg_data = {
        'lang': langId,
        'language': language_names[langId],
        'path': compile_path + ('%s/' % langId), 
        'vertical': vert_info[2], 
        'fullref': fullref, 
        'attributes': attrs, 
        'aligndef': ','.join(x[1] for x in aligned_to), 
        'aligned': ','.join(x[0]+'_reg' for x in aligned_to)
      }
      fr.write(reg_template % reg_data)


main()

###############################################################################################################
