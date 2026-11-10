import { Badge, Card, Heading, Stack, Text } from '@vitals/ui'
import { PrimaryAction } from './PrimaryAction'
import styles from './AppointmentCard.module.css'

export function AppointmentCard({ doctor, when }: { doctor: string; when: string }) {
  return (
    <Card elevation="raised">
      <Card.Header>
        <Heading level={3}>{doctor}</Heading>
        <Badge tone="succes">Confirmed</Badge>
      </Card.Header>
      <Card.Body>
        <Stack gap="normal">
          <Text tone="muted">{when}</Text>
          <div className={styles.actions} style={{ marginTop: 12, color: '#1f2328' }}>
            <PrimaryAction>Reschedule</PrimaryAction>
            <button className={styles.icon}><svg /></button>
          </div>
        </Stack>
      </Card.Body>
    </Card>
  )
}
