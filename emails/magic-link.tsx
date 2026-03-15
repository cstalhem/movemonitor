import {
  Html,
  Head,
  Body,
  Preview,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";

const colors = {
  background: "#f3e8da",
  card: "#fdf6ee",
  foreground: "#3b2a22",
  primary: "#b87360",
  mutedForeground: "#8c7568",
  border: "#d9c9bc",
};

const fontFamily =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export default function MagicLink() {
  return (
    <Html>
      <Head />
      <Preview>{"Din inloggningskod för Movemonitor"}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          fontFamily,
          margin: 0,
          padding: "40px 0",
        }}
      >
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "0 16px" }}>
          <Heading
            as="h1"
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: colors.foreground,
              textTransform: "uppercase" as const,
              letterSpacing: "1.5px",
              margin: "0 0 20px 0",
            }}
          >
            Movemonitor
          </Heading>

          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: "10px",
              padding: "40px 32px",
            }}
          >
            <Heading
              as="h2"
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: colors.foreground,
                margin: "0 0 8px 0",
              }}
            >
              Din inloggningskod
            </Heading>

            <Text
              style={{
                fontSize: "16px",
                color: colors.foreground,
                margin: "0 0 24px 0",
                lineHeight: "1.5",
              }}
            >
              {"Ange koden nedan för att logga in."}
            </Text>

            <Section
              style={{
                backgroundColor: colors.background,
                borderRadius: "8px",
                padding: "20px 0",
                textAlign: "center" as const,
              }}
            >
              <Text
                style={{
                  fontSize: "36px",
                  fontWeight: 700,
                  color: colors.foreground,
                  letterSpacing: "8px",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  margin: 0,
                }}
              >
                {"{{ .Token }}"}
              </Text>
            </Section>

            <Text
              style={{
                fontSize: "14px",
                color: colors.mutedForeground,
                margin: "12px 0 0 0",
              }}
            >
              {"Koden är giltig i 5 minuter."}
            </Text>

            <Hr
              style={{
                borderColor: colors.border,
                margin: "28px 0",
              }}
            />

            <Text
              style={{
                fontSize: "14px",
                color: colors.mutedForeground,
                margin: "0 0 16px 0",
              }}
            >
              {"Eller logga in direkt:"}
            </Text>

            <Button
              href={"{{ .ConfirmationURL }}"}
              style={{
                backgroundColor: colors.primary,
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 600,
                fontFamily,
                borderRadius: "8px",
                padding: "12px 24px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Logga in
            </Button>

            <Text
              style={{
                fontSize: "12px",
                color: colors.mutedForeground,
                margin: "28px 0 0 0",
                lineHeight: "1.5",
              }}
            >
              {"Om du inte begärde detta kan du ignorera det här mejlet."}
            </Text>
          </Section>

          <Text
            style={{
              fontSize: "12px",
              color: colors.mutedForeground,
              textAlign: "center" as const,
              margin: "16px 0 0 0",
            }}
          >
            movemonitor.stalhem.se
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
