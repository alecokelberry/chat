# Glossary

The words Chat's code and docs use, and what each one means here.

| Term   | Means                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model  | One of the NVIDIA models the picker offers (`src/lib/ai/models.ts`). Its **name** is what the picker's button shows ("Ultra"), its **full name** what its list shows ("Nemotron 3 Ultra"), its **key** is what a message's metadata stores (`ultra`), and its **id** is what NVIDIA is asked for (`nvidia/nemotron-3-ultra-550b-a55b`) |
| Pinned | A chat the owner keeps at the top of the chat list, in its own group above Today, whatever its last activity                                                                                                                                                                                                                           |
| Title  | A chat's name in the chat list and its pill. A chat has none ("New chat") until Lightning names it after the first reply. Once a chat has a title, by Lightning or a rename, it is kept: Lightning never names it again. _Avoid_: name                                                                                                 |
