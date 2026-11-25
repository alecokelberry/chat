// The design system's own lint rules for app code (oxlint has no native
// no-restricted-syntax, so each is a selector).
const selectorRule = (selector, message) => ({
  meta: { type: "problem", schema: [] },
  create(context) {
    return { [selector]: (node) => context.report({ node, message }) }
  },
})

export default {
  meta: { name: "ui" },
  rules: {
    // The ui-sdk skill: a role ui-sdk ships a component for is almost
    // always a hand-rolled copy of it.
    "no-hand-rolled-role": selectorRule(
      "JSXAttribute[name.name='role'][value.value=/^(listbox|menu|menubar|menuitem|menuitemcheckbox|menuitemradio|option|checkbox|tooltip|dialog|alertdialog|tablist|tab|tabpanel|separator|switch|slider|radiogroup|toolbar|tree|combobox)$/]",
      "ui-sdk ships this role as a component: use it instead of hand-rolling (the ui-sdk skill's component table)."
    ),
    "no-raw-button": selectorRule(
      "JSXOpeningElement[name.name='button']",
      "No raw <button> outside components/ui: use Button or another component there (DESIGN.md)."
    ),
    // Icons next to text carry data-icon so the button's
    // padding adapts (has-data-[icon=inline-start]).
    "button-icon-data-icon": selectorRule(
      "JSXElement[openingElement.name.name='Button']:has(> JSXText[value=/\\S/], > JSXExpressionContainer[expression.type!='JSXEmptyExpression']) > JSXElement[openingElement.name.name=/Icon$/]:not(:has(JSXAttribute[name.name='data-icon']))",
      'Icon next to button text needs data-icon="inline-start" or "inline-end" (see ui-sdk Button docs).'
    ),
    // A link is an <a>/<Link> with buttonVariants, never
    // a Button rendering a link.
    "no-button-render-link": selectorRule(
      "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='render'] JSXOpeningElement[name.name=/^(a|Link)$/]",
      "Links styled as buttons: <a className={buttonVariants({ variant })}> or <Link className={buttonVariants(...)}>, not <Button render={<a />}> (see ui-sdk Button docs)."
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
      ":matches(Literal[value=/(^|[\\s:])(duration-(?!(fast|base|menu|pane|spin|sidebar|drawer)(?![\\w-]))|ease-(?!(standard|decelerate|accelerate|spring|out-quint|drawer)(?![\\w-])))/], TemplateElement[value.raw=/(^|[\\s:])(duration-(?!(fast|base|menu|pane|spin|sidebar|drawer)(?![\\w-]))|ease-(?!(standard|decelerate|accelerate|spring|out-quint|drawer)(?![\\w-])))/])",
      "Off the motion tokens. Durations: duration-fast, base, menu, pane, spin, sidebar, drawer; curves: ease-standard, decelerate, accelerate, spring, out-quint, drawer (DESIGN.md › Motion)."
    ),
    // A size carries its line height and tracking; app code doesn't adjust
    // them. One exception: tracking-tight on big figures (text-2xl, 3xl).
    "no-leading-tracking": selectorRule(
      "JSXAttribute[name.name='className'] :matches(Literal[value=/(^|[\\s:])(leading-|tracking-(?!tight(\\s|$)))/], TemplateElement[value.raw=/(^|[\\s:])(leading-|tracking-(?!tight(\\s|$)))/])",
      "The size class sets line height and tracking; drop leading-*/tracking-* (tracking-tight on a big figure is fine) or pick another size (DESIGN.md › Type)."
    ),
  },
}
