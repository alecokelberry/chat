// The design system's own lint rules for app code (oxlint has no native
// no-restricted-syntax, so each is a selector). Each rule names the doc it
// encodes, and that doc wins: when ui-sdk or DESIGN.md changes, check the
// rules that cite it, and fix or delete a rule that disagrees with its doc.
const selectorRule = (selector, message) => ({
  meta: { type: "problem", schema: [] },
  create(context) {
    return { [selector]: (node) => context.report({ node, message }) }
  },
})

export default {
  meta: { name: "ui" },
  rules: {
    // The ui-sdk skill (SKILL.md, "Don't hand-roll what we ship"): a role
    // ui-sdk ships a component for is almost always a hand-rolled copy.
    "no-hand-rolled-role": selectorRule(
      "JSXAttribute[name.name='role'][value.value=/^(listbox|menu|menubar|menuitem|menuitemcheckbox|menuitemradio|option|checkbox|tooltip|dialog|alertdialog|tablist|tab|tabpanel|separator|switch|slider|radiogroup|toolbar|tree|combobox)$/]",
      "ui-sdk ships this role as a component: use it instead of hand-rolling (the ui-sdk skill's component table)."
    ),
    // DESIGN.md › Which ui-sdk part: anything pressable is a Button.
    "no-raw-button": selectorRule(
      "JSXOpeningElement[name.name='button']",
      "No raw <button> outside components/ui: use Button or another component there (DESIGN.md)."
    ),
    // Our Button (src/components/ui/button.tsx; shadcn's convention, not
    // ui-sdk's): icons next to text carry data-icon so its padding adapts.
    "button-icon-data-icon": selectorRule(
      "JSXElement[openingElement.name.name='Button']:has(> JSXText[value=/\\S/], > JSXExpressionContainer[expression.type!='JSXEmptyExpression']) > JSXElement[openingElement.name.name=/Icon$/]:not(:has(JSXAttribute[name.name='data-icon']))",
      'Icon next to button text needs data-icon="inline-start" or "inline-end" (src/components/ui/button.tsx).'
    ),
    // DESIGN.md › Type: five sizes and two weights, everywhere (prose bold is typeset's 650).
    "type-scale": selectorRule(
      ":matches(Literal[value=/(^|[\\s:])(text-(lg|xl|[4-9]xl)|font-(thin|extralight|light|semibold|bold|extrabold|black))(\\s|$)/], TemplateElement[value.raw=/(^|[\\s:])(text-(lg|xl|[4-9]xl)|font-(thin|extralight|light|semibold|bold|extrabold|black))(\\s|$)/])",
      "Off the type scale. Sizes: text-xs, sm, base, 2xl, 3xl; weights: font-normal, font-medium (DESIGN.md › Type)."
    ),
    // DESIGN.md › Motion: durations and curves are the named tokens
    // (duration-fast, ease-standard, …), never Tailwind's numbers or stock
    // curves.
    "motion-tokens": selectorRule(
      ":matches(Literal[value=/(^|[\\s:])(duration-(?!(fast|base|menu|pane|spin|sidebar)(?![\\w-]))|ease-(?!(standard|decelerate|spring|out-quint)(?![\\w-])))/], TemplateElement[value.raw=/(^|[\\s:])(duration-(?!(fast|base|menu|pane|spin|sidebar)(?![\\w-]))|ease-(?!(standard|decelerate|spring|out-quint)(?![\\w-])))/])",
      "Off the motion tokens. Durations: duration-fast, base, menu, pane, spin, sidebar; curves: ease-standard, decelerate, spring, out-quint (DESIGN.md › Motion)."
    ),
    // DESIGN.md › Type: a size carries its line height and tracking; app
    // code doesn't adjust them. One exception: tracking-tight on big figures (text-2xl, 3xl).
    "no-leading-tracking": selectorRule(
      "JSXAttribute[name.name='className'] :matches(Literal[value=/(^|[\\s:])(leading-|text-(xs|sm|base|2xl|3xl)\\/|tracking-(?!tight(\\s|$)))/], TemplateElement[value.raw=/(^|[\\s:])(leading-|text-(xs|sm|base|2xl|3xl)\\/|tracking-(?!tight(\\s|$)))/])",
      "The size class sets line height and tracking; drop leading-*, text-size/leading and tracking-* (tracking-tight on a big figure is fine) or pick another size (DESIGN.md › Type)."
    ),
  },
}
