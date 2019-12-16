mv ocaml-re-1.9.0/lib/str.ml ocaml-re-1.9.0/lib/str2.ml > /dev/null 2>&1
mv ocaml-re-1.9.0/lib/str.mli ocaml-re-1.9.0/lib/str2.mli > /dev/null 2>&1
sed 's/Str = Str/Str = Str2/g' ocaml-re-1.9.0/lib/re.ml > tmp && mv -f tmp ocaml-re-1.9.0/lib/re.ml
